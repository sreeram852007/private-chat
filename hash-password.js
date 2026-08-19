const bcrypt = require('bcrypt');
const saltRounds = 10;
const password = 'admin123';
bcrypt.hash(password, saltRounds, function(err, hash) {
    if (err) throw err;
    console.log('New hashed password:', hash);
});