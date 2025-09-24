export function createDualPostEmailTemplate(shortPost, longPost, userProfile) {
    return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your LinkedIn Posts - Short & Long Versions</title>
      <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
              line-height: 1.6; 
              color: #27272a; 
              background: linear-gradient(135deg, #f4f4f5 0%, #e4e4e7 50%, #d4d4d8 100%);
              padding: 20px;
          }
          .container { 
              max-width: 700px; 
              margin: 0 auto; 
              background: rgba(255, 255, 255, 0.95); 
              backdrop-filter: blur(10px);
              border-radius: 24px; 
              overflow: hidden; 
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
              border: 1px solid rgba(228, 228, 231, 0.6);
          }
          .header { 
              background: linear-gradient(135deg, #18181b, #27272a); 
              padding: 40px 32px; 
              text-align: center; 
              position: relative;
              overflow: hidden;
          }
          .header h1 { 
              color: white; 
              font-size: 32px; 
              font-weight: 700; 
              margin-bottom: 8px;
          }
          .header p { 
              color: #d4d4d8; 
              font-size: 18px;
              font-weight: 500;
          }
          .content { 
              padding: 48px 32px; 
          }
          .post-section {
              margin-bottom: 40px;
          }
          .post-label {
              display: inline-block;
              padding: 6px 14px;
              background: linear-gradient(135deg,rgb(66, 66, 73),rgb(80, 79, 84));
              color: white;
              border-radius: 8px;
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 16px;
          }
          .post-preview { 
              background: linear-gradient(135deg, #f9fafb, #f4f4f5);
              border: 2px solid #e4e4e7; 
              border-radius: 16px; 
              padding: 24px; 
              position: relative;
              box-shadow: 0 10px 25px -12px rgba(0, 0, 0, 0.1);
          }
          .post-content { 
              font-size: 15px; 
              line-height: 1.7; 
              color: #374151; 
              white-space: pre-wrap;
              font-weight: 500;
          }
          .cta-section {
              text-align: center;
              margin: 40px 0;
              padding: 32px;
              background: linear-gradient(135deg, #fafafa, #f5f5f5);
              border-radius: 16px;
          }
          .cta-button { 
              display: inline-block; 
              background: linear-gradient(135deg,rgb(12, 13, 13),rgb(45, 49, 52));
              color: white; 
              padding: 18px 36px; 
              border-radius: 12px; 
              text-decoration: none; 
              font-weight: 600; 
              font-size: 16px;
              box-shadow: 0 8px 25px -8px rgba(0, 119, 181, 0.5);
              transition: transform 0.2s;
          }
          .footer { 
              background: linear-gradient(135deg, #f9fafb, #f4f4f5);
              padding: 32px; 
              border-top: 1px solid #e4e4e7; 
              text-align: center; 
              color: #6b7280; 
              font-size: 14px;
              font-weight: 500;
          }
          .divider {
              height: 1px;
              background: linear-gradient(to right, transparent, #d4d4d8, transparent);
              margin: 32px 0;
          }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="header">
              <h1>Your LinkedIn Posts Are Ready!</h1>
              <p>1 Short + 1 Long Format Post</p>
          </div>
          
          <div class="content">
              <div style="text-align: center; margin-bottom: 32px;">
                  <p style="color: #6b7280; font-size: 16px;">
                      Choose the version that fits your current mood and audience!
                  </p>
              </div>
  
              <div class="post-section">
                  <span class="post-label">Short Post</span>
                  <div class="post-preview">
                      <div class="post-content">${shortPost || 'Short post not generated'}</div>
                  </div>
              </div>
  
              <div class="divider"></div>
  
              <div class="post-section">
                  <span class="post-label">Long Post</span>
                  <div class="post-preview">
                      <div class="post-content">${longPost || 'Long post not generated'}</div>
                  </div>
              </div>
  
              <div class="cta-section">
                  <h3 style="margin-bottom: 20px; color: #18181b; font-size: 20px;">Ready to Post?</h3>
                  <a href="https://linkedin.com/feed" class="cta-button" target="_blank">
                      Open LinkedIn →
                  </a>
              </div>
          </div>
          
          <div class="footer">
              <div style="font-weight: 700; color: #18181b; margin-bottom: 8px;">ThoughtLeader AI</div>
              <p>Automated LinkedIn Content Generation</p>
              <p style="margin-top: 16px; font-size: 12px;">
                  This email was sent to ${userProfile?.email || 'your email'}
              </p>
          </div>
      </div>
  </body>
  </html>`;
  }
  
  export function createReceiptEmailTemplate(receiptData, userProfile) {
    return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Receipt - ThoughtLeader AI</title>
      <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; }
          .header { background: linear-gradient(135deg, #18181b, #27272a); padding: 32px; text-align: center; color: white; }
          .content { padding: 32px; }
          .receipt-details { background: #f9fafb; padding: 24px; border-radius: 8px; margin: 20px 0; }
          .total { font-size: 24px; font-weight: bold; color: #059669; text-align: center; margin: 20px 0; }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="header">
              <h1>Payment Successful!</h1>
              <p>Receipt #${receiptData.receiptNumber}</p>
          </div>
          <div class="content">
              <h2>Thank you for your purchase!</h2>
              <div class="receipt-details">
                  <p><strong>Plan:</strong> ${receiptData.planName}</p>
                  <p><strong>Amount:</strong> ${receiptData.amount}</p>
                  <p><strong>Date:</strong> ${receiptData.date}</p>
                  <p><strong>Transaction ID:</strong> ${receiptData.transactionId}</p>
              </div>
              <div class="total">Total Paid: ${receiptData.amount}</div>
              <p>Your premium features are now active. Start creating amazing content!</p>
          </div>
      </div>
  </body>
  </html>`;
  }