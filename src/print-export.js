let activePrintFrame = null;

export async function preparePreviewForPrint(previewElement, markdownCss) {
    activePrintFrame?.remove();
    const frame = document.createElement('iframe');
    frame.title = 'PDF export';
    frame.style.cssText = 'position:fixed;left:-100000px;top:0;width:1440px;height:900px;border:0;';
    document.body.appendChild(frame);
    activePrintFrame = frame;

    try {
        const doc = frame.contentDocument;
        doc.open();
        doc.write('<!doctype html><html><head><title>markdown-preview</title></head><body></body></html>');
        doc.close();

        const base = doc.createElement('base');
        base.href = document.baseURI;
        doc.head.appendChild(base);

        const style = doc.createElement('style');
        style.textContent = `${markdownCss}
html, body { margin:0; padding:0; width:1440px; height:auto; background:#fff; color:#1f2328; overflow:visible; }
#print-content { box-sizing:border-box; width:1440px; padding:8px 16px 16px; }
.mermaid { padding:16px; text-align:center; }
.mermaid svg { display:block; max-width:100%; height:auto; margin:0 auto; }
* { -webkit-print-color-adjust:exact; print-color-adjust:exact; }`;
        doc.head.appendChild(style);

        const content = doc.createElement('div');
        content.id = 'print-content';
        const output = doc.importNode(previewElement.querySelector('#output'), true);
        output.removeAttribute('id');
        content.appendChild(output);
        doc.body.appendChild(content);

        // Force layout before waiting for fonts in the offscreen document.
        content.getBoundingClientRect();
        await doc.fonts.ready;
        await Promise.all([...content.querySelectorAll('img')].map((image) => {
            if (image.complete) return Promise.resolve();
            return new Promise((resolve) => {
                const timeout = setTimeout(resolve, 10000);
                const finish = () => { clearTimeout(timeout); resolve(); };
                image.addEventListener('load', finish, { once: true });
                image.addEventListener('error', finish, { once: true });
            });
        }));

        // A small rounding allowance keeps the final line on the same page.
        const contentHeightPx = Math.ceil(Math.max(content.scrollHeight, content.getBoundingClientRect().height)) + 2;
        const pageHeightMm = contentHeightPx * 25.4 / 96 + 20;
        const pageStyle = doc.createElement('style');
        pageStyle.textContent = `@page { size:401mm ${pageHeightMm}mm; margin:10mm; }`;
        doc.head.appendChild(pageStyle);

        frame.contentWindow.addEventListener('afterprint', () => {
            frame.remove();
            if (activePrintFrame === frame) activePrintFrame = null;
        }, { once: true });
        return frame;
    } catch (error) {
        frame.remove();
        if (activePrintFrame === frame) activePrintFrame = null;
        throw error;
    }
}
