import { MarkdownPostProcessorContext } from 'obsidian';

export function clozeRenderer(el: HTMLElement, ctx: MarkdownPostProcessorContext, enabled: boolean, highlight: boolean) {
    if (!enabled) return;

    const replaceText = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.nodeValue;
            if (!text) return;
            const regex = /{{c\d+::(.*?)(?:::(.*?))?}}/g;

            // Simple replacement if no highlight needed
            if (!highlight) {
                if (regex.test(text)) {
                    node.nodeValue = text.replace(regex, '$1');
                }
                return;
            }

            // Highlight replacement
            let match;
            let lastIndex = 0;
            const fragment = document.createDocumentFragment();
            let found = false;

            // Reset regex state just in case, though usually fresh for local var
            regex.lastIndex = 0;

            while ((match = regex.exec(text)) !== null) {
                found = true;
                // Add text before match
                if (match.index > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
                }
                // Add highlighted match
                const mark = document.createElement('mark');
                mark.textContent = match[1]; // The answer part
                fragment.appendChild(mark);

                lastIndex = match.index + match[0].length;
            }

            if (found) {
                // Add remaining text
                if (lastIndex < text.length) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
                }
                node.parentNode?.replaceChild(fragment, node);
            }

        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Using Array.from to avoid issues if childNodes structure changes, 
            // though here we only modify text content so it should be safe.
            Array.from(node.childNodes).forEach(replaceText);
        }
    }
    replaceText(el);
}
