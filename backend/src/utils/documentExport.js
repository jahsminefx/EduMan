const PDFDocument = require('pdfkit');
const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel
} = require('docx');

function safeFilename(title, extension) {
    const base = String(title || 'learning-content')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
        .slice(0, 80) || 'learning-content';
    return `${base}.${extension}`;
}

function parseBodyLines(body) {
    return String(body || '').split(/\r?\n/);
}

function sendPdf(res, resource) {
    const filename = safeFilename(resource.title, 'pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 54, size: 'A4' });
    doc.pipe(res);
    doc.fontSize(20).font('Helvetica-Bold').text(resource.title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('#4b5563')
        .text(`${resource.subject_name || 'Subject'} • ${resource.class_name || 'Class'} • ${resource.academic_session || ''} ${resource.term || ''}`, { align: 'center' });
    doc.moveDown(1.5);
    doc.fillColor('#111827');

    for (const line of parseBodyLines(resource.body)) {
        if (line.startsWith('### ')) {
            doc.moveDown(0.4).font('Helvetica-Bold').fontSize(13).text(line.slice(4));
        } else if (line.startsWith('## ')) {
            doc.moveDown(0.6).font('Helvetica-Bold').fontSize(15).text(line.slice(3));
        } else if (line.startsWith('# ')) {
            doc.moveDown(0.8).font('Helvetica-Bold').fontSize(17).text(line.slice(2));
        } else if (/^[-*]\s+/.test(line)) {
            doc.font('Helvetica').fontSize(11).text(`• ${line.replace(/^[-*]\s+/, '')}`, { indent: 12 });
        } else if (!line.trim()) {
            doc.moveDown(0.5);
        } else {
            doc.font('Helvetica').fontSize(11).text(line, { lineGap: 3 });
        }
    }

    doc.end();
}

async function sendDocx(res, resource) {
    const children = [
        new Paragraph({
            text: resource.title,
            heading: HeadingLevel.TITLE
        }),
        new Paragraph({
            children: [
                new TextRun({
                    text: `${resource.subject_name || 'Subject'} • ${resource.class_name || 'Class'} • ${resource.academic_session || ''} ${resource.term || ''}`,
                    italics: true,
                    color: '4B5563'
                })
            ]
        })
    ];

    for (const line of parseBodyLines(resource.body)) {
        if (line.startsWith('### ')) {
            children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
        } else if (line.startsWith('## ')) {
            children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
        } else if (line.startsWith('# ')) {
            children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
        } else if (/^[-*]\s+/.test(line)) {
            children.push(new Paragraph({ text: line.replace(/^[-*]\s+/, ''), bullet: { level: 0 } }));
        } else {
            children.push(new Paragraph({ text: line || ' ' }));
        }
    }

    const document = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(document);
    const filename = safeFilename(resource.title, 'docx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
}

module.exports = {
    sendPdf,
    sendDocx
};
