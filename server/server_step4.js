
let os = require('os');
let static = require('node-static');
let http = require('http');
let socketIO = require('socket.io');

let fileServer = new(static.Server)();
let app = http.createServer((req, res) => {
    fileServer.serve(req, res);
}).listen(8080);

let io = socketIO.listen(app);

io.sockets.on('connection', socket => {

    function log() {
        let array = ['>>> Message from server: '];
        array.push.apply(array, arguments);
        socket.emit('log', array);
    }

    socket.on('message', message => {
        log('Client said:', message);
        socket.broadcast.emit('message', message);
    });

    socket.on('create or join', function(room) {
        log('Request to create or join room ' + room);
        let numClients = io.sockets.clients(room).length;
        log('Room ' + room + ' has ' + numClients + ' client(s)');

        if (numClients === 0) {
            socket.join(room);
            socket.emit('created', room, socket.id);
        } else if (numClients === 1) {
            socket.join(room);
            socket.emit('joined', room.id);
            io.sockets.in(room).emit('ready');
        } else {
            socket.emit('full', room);
        }
    });

    socket.on('ipaddr', function() {
        let ifaces = os.networkInterfaces();
        for (let dev in ifaces) {
            ifaces[dev].forEach(details => {
                if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
                    socket.emit('ipaddr', details.address);
                }
            });
        }
    });

});

