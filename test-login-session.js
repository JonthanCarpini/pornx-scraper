import fetch from 'node-fetch';

async function testLogin() {
    try {
        console.log('🔐 Testando login...');
        
        const response = await fetch('http://agenciavirtual.site:3001/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: 'jonathan9140',
                password: 'Metallica@2020'
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ Login bem-sucedido!');
            console.log('Token:', data.token ? 'Presente' : 'Ausente');
            console.log('SessionToken:', data.sessionToken ? 'Presente' : 'Ausente');
            console.log('User ID:', data.user?.id);
            console.log('Username:', data.user?.username);
        } else {
            console.log('❌ Erro no login:', data);
        }

        // Aguardar 2 segundos e verificar sessão no banco
        console.log('\n⏳ Aguardando 2 segundos...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verificar online users
        console.log('🔍 Verificando usuários online...');
        const onlineResponse = await fetch('http://agenciavirtual.site:3001/api/session/online-users');
        const onlineData = await onlineResponse.json();
        
        console.log('Usuários online:', onlineData.count);
        console.log('Detalhes:', JSON.stringify(onlineData.online_users, null, 2));

    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

testLogin();
