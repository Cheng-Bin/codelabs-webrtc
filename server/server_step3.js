
let static = require('node-static');
let http = require('http');
let socketIO = require('socket.io');
let file = new(static.Server)();
let app = http.createServer((req, res) => {
    file.serve(req, res);
}).listen(2013);
let io = socketIO.listen(app);

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
        let numClients = io.sockets.clients(room).length;

        log('Room ' + room + ' has ' + numClients + ' client(s)');
        log('Request to create or join room ' + room);

        if (numClients === 0) {
            socket.join(room);
            socket.emit('created', room);
        } else if (numClients === 1) {
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