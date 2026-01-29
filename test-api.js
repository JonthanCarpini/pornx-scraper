import dotenv from 'dotenv';

dotenv.config();

async function testAPI() {
    const username = process.argv[2] || 'msmartinasmith';
    
    console.log(`\n🔍 Testando API para: ${username}\n`);
    
    try {
        const apiUrl = `https://www.xxxfollow.com/api/v1/user/${username}/post/public?limit=3&sort_by=recent`;
        
        console.log(`📡 URL: ${apiUrl}\n`);
        
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) {
            console.log(`❌ Status: ${response.status}`);
            return;
        }
        
        const data = await response.json();
        
        console.log(`✅ Status: ${response.status}`);
        console.log(`📦 Itens retornados: ${Array.isArray(data) ? data.length : 'não é array'}\n`);
        
        if (Array.isArray(data) && data.length > 0) {
            console.log('📋 JSON COMPLETO (primeiros 3 itens):\n');
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log('⚠️  Resposta não é array ou está vazia');
            console.log(JSON.stringify(data, null, 2));
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

testAPI();
