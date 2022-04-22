var crypto = require('crypto');
var utils = {};

//AES加密
utils.desEncode = function desEncode(desKey, data) {
    var cipherChunks = [];
    const iv = crypto.randomBytes(0);
    var cipher = crypto.createCipheriv('aes-128-ecb', desKey, iv);
    cipher.setAutoPadding(true);
    cipherChunks.push(cipher.update(data, 'utf8', 'base64'));
    cipherChunks.push(cipher.final('base64'));

    return cipherChunks.join('');
}

utils.md5 = function (password) {
    var md5 = crypto.createHash('md5');
    return md5.update(password).digest('hex');
}

utils.delay = (s) => {
    return new Promise(resolve => {
        setTimeout(resolve, s);
    });
};

utils.checkRobotStatus = (robots, robotData) => {
    for (let index = 0; index < robots.length; index++) {
        const element = robots[index];
        if (robotData[element.name]?.stopDate === 'NA'){
            return false;
        }
    }
    return true;
};


utils.lifeType = { 
    unKnow : 0,
    finish : 1,
    live : 2,
    connectFail : 3,
    loginFail : 4,
    userStop : 5,
    getGameListFail : 6 
}

module.exports = utils;