require('dotenv').config();
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function checkModels() {
  try {
    console.log('🔍 Checking available Groq models...\n');
    const models = await groq.models.list();
    
    console.log(`Total models available: ${models.data.length}\n`);
    
    // Filter for vision models
    const visionModels = models.data.filter(m => 
      m.id.includes('qwen') || 
      m.id.includes('vision') ||
      m.id.includes('llama-4')
    );
    
    console.log('📷 Vision/ multimodal models:');
    visionModels.forEach(m => {
      console.log(`  - ${m.id}`);
    });
    
    // Filter for text models
    const textModels = models.data.filter(m => 
      !m.id.includes('qwen') && 
      !m.id.includes('vision') &&
      !m.id.includes('llama-4')
    );
    
    console.log('\n📝 Text models (recommended for AI scan):');
    textModels.slice(0, 10).forEach(m => {
      console.log(`  - ${m.id}`);
    });
    
    console.log('\n✅ All available models:');
    models.data.forEach(m => {
      console.log(`  - ${m.id}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkModels();
