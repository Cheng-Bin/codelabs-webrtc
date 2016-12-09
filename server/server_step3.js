
let static = require('node-static');
let http = require('http');
let file = new(static.Server)();
let app = http.createServer((req, res) => {
    file.serve(req, res);
}).listen(2013);

let roomClients = [];
let io = require('socket.io').listen(app);
io.sockets.on('connection', socket => {

    function log() {
        let array = ['>>> Message from server: '];
        for (let i = 0; i < arguments.length; i++) {
            array.push(arguments[i]);
        }

        socket.emit('log', array);
    }

    socket.on('message', message => {
        log('Got message: ', message);
        socket.broadcast.emit('message', message);
    });

    socket.on('create or join', room => {
        if (roomClients[room] == undefined) {
            roomClients[room] = 0;
        } else {
            roomClients[room] ++;
        }

        log('Room ' + room + ' has ' + roomClients[room] + ' client(s)');
        log('Request to create or join room ' + room);

        if (roomClients[room] === 0) {
            socket.join(room);
            socket.emit('created', room);
        } else if (roomClients[room] === 1) {
            io.sockets.in(room).emit('join', room);
            socket.join(room);
            socket.emit('joined', room);
        } else {
            socket.emit('full', room);
        }

        socket.emit('emit(): client ' + socket.id + ' joined room ' + room);
        socket.broadcast.emit('brocast(): client ' + socket.id + ' joined room ' + room);
        
    });

});