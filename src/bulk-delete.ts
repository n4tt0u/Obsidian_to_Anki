import { App, TFile, Notice } from 'obsidian';
import * as AnkiConnect from './anki';
import { ID_REGEXP_STR } from './note';
import { DeleteConfirmationModal } from './ui/DeleteConfirmationModal';

export async function checkAndBulkDelete(app: App, file: TFile) {
    const content = await app.vault.read(file);
    const regex = new RegExp(ID_REGEXP_STR, 'g');
    const matches = [...content.matchAll(regex)];
    const ids = matches.map(m => parseInt(m[1])).filter(id => !isNaN(id));

    // Check for Frontmatter ID
    let frontmatterID: number | null = null;
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const fmMatch = content.match(frontmatterRegex);
    if (fmMatch) {
        const frontmatter = fmMatch[1];
        const nidMatch = frontmatter.match(/^nid:\s*(\d+)/m);
        if (nidMatch) {
            frontmatterID = parseInt(nidMatch[1]);
            if (!isNaN(frontmatterID)) {
                ids.push(frontmatterID);
            }
        }
    }

    if (ids.length === 0) {
        new Notice("No IDs found in this file.");
        return;
    }

    new DeleteConfirmationModal(app, file.name, ids.length, async () => {
        // Delete from Anki
        try {
            // deleteNotes returns a request object, so we must use invoke or parse the response if we were using multi
            // But here we want a single action.
            // AnkiConnect.invoke('deleteNotes', { notes: ids })
            const response = await AnkiConnect.invoke('deleteNotes', { notes: ids }) as any;
            if (response && response.error) {
                new Notice("Error deleting notes from Anki: " + response.error);
                return;
            }
        } catch (e) {
            console.error(e);
            new Notice("Failed to connect to Anki.");
            return;
        }

        // Remove IDs from file
        let newContent = content;
        // Using replace with the global regex removes all instances
        // We use the same regex ID_REGEXP_STR. 
        // Note: The regex includes optional newlines at start.
        newContent = newContent.replace(regex, "");

        // Remove Frontmatter ID property
        if (frontmatterID) {
            newContent = newContent.replace(frontmatterRegex, (match, fmContent) => {
                let newFm = fmContent;
                const trimmed = newFm.trim();

                if (/nid:[^\n]*$/.test(trimmed)) {
                    // Last property: Remove entirely
                    // Removes newline before if exists, and the line itself
                    newFm = newFm.replace(/(\n\s*)?nid:[^\n]*\s*$/, "");
                } else {
                    // Not last property: Clear value
                    newFm = newFm.replace(/^(nid:).*/m, "$1");
                }

                return `---\n${newFm}\n---`;
            });
        }

        // Remove potential Double Newlines created by removal?
        // Logic in file.ts fix_newline_ids handles this usually, but a simple replace is okay.

        try {
            await app.vault.modify(file, newContent);
            new Notice(`Deleted ${ids.length} notes from Anki and removed IDs from file.`);
        } catch (e) {
            new Notice("Error updating file.");
            console.error(e);
        }

    }).open();
}
