import bcrypt from 'bcrypt';

const password = 'admin123';
const hash = bcrypt.hashSync(password, 10);

console.log('Senha:', password);
console.log('Hash:', hash);
console.log('\nAdicione ao .env:');
console.log(`ADMIN_PASSWORD=${hash}`);
