"use strict";
const cluster = require('cluster');
const os = require('os');
const venom = require('venom-bot');
const fs = require('fs');
const RedisFn = require('./fnredis');
const Redis = require('ioredis');
const client = new Redis();
const clientsFn = new RedisFn(client);
const CircularJSON = require('flatted');

if (cluster.isWorker) {
    var express = require('express');
    var app = express();

    var http = require('http');
    var server = http.createServer(app);
    var io = require('socket.io').listen(server);
    var redis = require('socket.io-redis');

    io.adapter(redis({
        host: 'localhost',
        port: 6379
    }));

    io.on('connection', function (socket) {
        socket.emit('data', 'connected to worker: ' + cluster.worker.id);
    });

    (async function () {
        await clientsFn.set('client', 'false', "clientVenom")
    }());

    // iniciando venom
    app.get('/init', async (req, res) => {
        let clientVenom = await clientsFn.get("clientVenom");
        clientVenom = JSON.parse(clientVenom)
        clientVenom = (clientVenom && clientVenom.client != 'false') ? clientVenom.client : false;
        if (!clientVenom || clientVenom == false) {
            res.status(200).json({
                success: true,
                message: 'Venom foi iniciado, leia o qrcode'
            });
            if (fs.existsSync(__dirname + '/qrcode.png')) {
                fs.unlinkSync(__dirname + '/qrcode.png');
            }
            venom
                .create(
                    // session
                    'clientVenom',
                    // exporting qrcode
                    (base64Qr) => {
                        var matches = base64Qr.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
                            response = {};

                        if (matches.length !== 3) {
                            return new Error('Invalid input string');
                        }
                        response.type = matches[1];
                        response.data = new Buffer.from(matches[2], 'base64');

                        var imageBuffer = response;
                        fs.writeFile(
                            'qrcode.png',
                            imageBuffer['data'],
                            'binary',
                            function (err) {
                                if (err != null) {
                                    console.log(err);
                                }
                                console.log('qrcode exportado');
                            }
                        );

                    },
                    // statusFind
                    (statusSession) => {
                        console.log('Status Session: ', statusSession);
                    },
                    // options
                    {
                        headless: false,
                        devtools: false,
                        useChrome: true,
                        debug: false,
                        logQR: true,
                        browserWS: '',
                        disableSpins: true,
                        disableWelcome: true,
                        updatesLog: true,
                        autoClose: 60000
                    }
                )
                .then(async (client) => {
                    if (fs.existsSync(__dirname + '/qrcode.png')) {
                        fs.unlinkSync(__dirname + '/qrcode.png');
                    }
                    console.log(client)
                    // let clientobj = CircularJSON.stringify(client);
                    await clientsFn.set('client', `${client}`, "clientVenom")
                    // clientVenom = client;
                })
                .catch(async (erro) => {
                    await clientsFn.set('client', 'false', "clientVenom")
                    console.log(erro);
                });
        } else {
            res.status(200).json({
                success: true,
                message: 'venom já foi lido'
            });
        }
    });

    // deletando cliente
    app.get('/deleteCliente', async (req, res) => {
        await clientsFn.del('client', "clientVenom");
        res.status(200).json({
            success: true,
            message: 'Cliente deletado'
        });
    });

    // deletando cliente
    app.get('/qrcode', async (req, res) => {
        let clientVenom = await clientsFn.get("clientVenom");
        clientVenom = JSON.parse(clientVenom)
        clientVenom = (clientVenom && clientVenom.client != 'false') ? clientVenom.client : false;
        if (fs.existsSync(__dirname + '/qrcode.png')) {
            res.sendFile('qrcode.png', {
                root: __dirname
            });
        } else {
            if (clientVenom && clientVenom != false) {
                res.status(200).json({
                    success: true,
                    message: 'Venom já foi lido'
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Qrcode ainda não foi exportado'
                });
            }
        }
    });

    // Enviar mensagens
    app.get('/enviarmsg', async (req, res) => {
        let clientVenom = await clientsFn.get("clientVenom");
        console.log(clientVenom)
        console.log(clientVenom.client)
        clientVenom = JSON.parse(clientVenom)
        clientVenom = (clientVenom && clientVenom.client != 'false') ? clientVenom.client : false;
        let chatId = req.query.numero;
        let msg = req.query.msg;
        if (clientVenom && clientVenom != false) {
            clientVenom = CircularJSON.parse(clientVenom)
            console.log(clientVenom)
            if (chatId && msg) {
                msg = msg.replace(/<br>/gi, "\n");
                try {
                    let resp = await clientVenom.sendText(chatId + '@c.us', '' + msg);
                    res.status(200).json({
                        success: true,
                        message: resp
                    });
                } catch (e) {
                    console.log(e);
                    res.status(500).json({
                        success: false,
                        message: 'Algo deu errado!'
                    });
                }
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Request imcompleto, necessita revisão!'
                });
            }
        } else {
            res.status(400).json({
                success: false,
                message: 'Venom ainda não foi lido corretamente!'
            });
        }
    });

    app.listen(3000, function () {
        console.log("Express server listening on port 3000 as Worker !");
    });
}

if (cluster.isMaster) {
    // we create a HTTP server, but we do not use listen
    // that way, we have a socket.io server that doesn't accept connections
    var server = require('http').createServer();
    var io = require('socket.io').listen(server);
    var redis = require('socket.io-redis');

    client.on("error", function (error) {
        console.error(error);
    });

    client.on('connect', function () {
        console.log('connected');
    });

    io.adapter(redis({
        host: 'localhost',
        port: 6379
    }));

    for (var i = 0; i < os.cpus().length; i++) {
        cluster.fork();
    }

    cluster.on('exit', function (worker, code, signal) {
        console.log('worker ' + worker.process.pid + ' died');
    });
}