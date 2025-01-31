const bcrypt = require('bcrypt');

bcrypt.hash('admin123', 10, function(err, hash) {
    if (err) throw err;
    console.log(hash);
});
