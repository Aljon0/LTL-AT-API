export async function extractTextFromDocument(file) {
    try {
      console.log(`Processing file: ${file.originalname}, type: ${file.mimetype}, size: ${file.size}`);
      
      switch (file.mimetype) {
        case 'application/pdf':
          return `[PDF Document: ${file.originalname} - PDF text extraction will be implemented. File contains ${file.size} bytes of content.]`;
        
        case 'text/plain':
          try {
            const text = file.buffer.toString('utf-8');
            console.log(`Text file processed successfully, extracted ${text.length} characters`);
            return text;
          } catch (textError) {
            console.error(`Text parsing error for ${file.originalname}:`, textError);
            return `[Error reading text file: ${file.originalname} - ${textError.message}]`;
          }
        
        default:
          return `[Unsupported file type: ${file.mimetype}]`;
      }
    } catch (error) {
      console.error(`General error extracting text from ${file.originalname}:`, error);
      return `[Error reading document: ${file.originalname} - ${error.message}]`;
    }
  }