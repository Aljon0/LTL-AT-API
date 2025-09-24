import { extractTextFromDocument } from '../services/documentService.js';

export async function processDocuments(req, res) {
  try {
    const origin = req.get('origin') || 'no-origin';
    console.log('=== Document Processing Request ===');
    console.log('Files received:', req.files?.length || 0);
    console.log('Request origin:', origin);
    
    if (!req.files || req.files.length === 0) {
      return res.json({ 
        documentContext: '', 
        processedFiles: 0, 
        totalCharacters: 0,
        message: 'No documents provided'
      });
    }

    const documentTexts = [];
    
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      try {
        const text = await extractTextFromDocument(file);
        documentTexts.push(`--- ${file.originalname} ---\n${text}\n`);
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        documentTexts.push(`--- ${file.originalname} ---\n[Error processing file: ${fileError.message}]\n`);
      }
    }
    
    const documentContext = documentTexts.join('\n');

    console.log('✅ Document processing successful');
    res.json({ 
      documentContext,
      processedFiles: req.files.length,
      totalCharacters: documentContext.length,
      message: 'Documents processed successfully'
    });
  } catch (error) {
    console.error('❌ Error processing documents:', error);
    res.status(500).json({ 
      error: 'Failed to process documents', 
      details: error.message 
    });
  }
}
