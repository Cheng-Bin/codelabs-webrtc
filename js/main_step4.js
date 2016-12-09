/***********************
 *     initial setup
 * *********************/

let configuration = {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]};
function $(id) { return document.getElementById(id); }
function randomToken() { return Math.floor(1 + Math.random() * 1e16).toString(16).substring(1);}
function logError(err) { console.log(err.toString(), err); }
function show() { 
    Array.prototype.forEach.call(arguments, function(ele) {
        ele.style.display = null;
    }); 
}
function hiden() {
    Array.prototype.forEach.call(arguments, function(ele) {
        ele.style.display = 'none';
    });
}


// getElementById
let roomURL = $('url');
let video = $('video');
let trail = $('trail');
let snapBtn = $('snap');
let sendBtn = $('send');
let snapAndSendBtn = $('snapAndSend');
let photo = $('photo');
let photoContext = photo.getContext('2d');
let photoContextW = 300;
let photoContextH = 150;

// add Event
video.addEventListener('play', setCanvasDimensions);
snapBtn.addEventListener('click', snapPhoto);
sendBtn.addEventListener('click', sendPhoto);
snapAndSendBtn.addEventListener('click', snapAndSend);

// create a random room if not alreay present in then url
let isInitiator;
let room = window.location.hash.substring(1);
if (!room) {
    room = window.location.hash = randomToken();
}

alert(room);


/****************************
 *  User Media
 ****************************/

function grabWebCamVideo() {
    console.log('Getting user media (video) ... ');
    let constraints = { 
        audio: true,
        video: true 
    };
    navigator.mediaDevices.getUserMedia(constraints)
        .then(function(mediaStream) {
            let streamUrl = window.URL.createObjectURL(mediaStream);
            console.log('getUserMedia video stream url : ', streamUrl);
            window.stream = mediaStream;
            video.src = streamUrl;
            show(snapBtn);
        })
        .catch(function(err) {
             console.log('getUserMedia error: ', err);
        });
}


/******************************
 *  Signaling server
 * ***************************/
let socket = io.connect('http://localhost:8080');

socket.on('ipaddr', function(ipaddr) {
    console.log('Server Ip address is : ' + ipaddr);
    updateRoomURL(ipaddr);
});

socket.on('created', function(room, clientId) {
    console.log('Created room', room, ' - my client ID is ', clientId);
    isInitiator = true;
    grabWebCamVideo();
});


socket.on('joined', function(room, clientId) {
    console.log('This Peer has joined room ', room, ' with client ID', clientId);
    isInitiator = false;
    grabWebCamVideo();
});

socket.on('full', function(room) {
    alert('Room "' + room + '" is full. We will create new room for you.');
    window.location.hash = '';
    window.location.reload();
});

socket.on('ready', function() {
    createPeerConnection(isInitiator, configuration);
});

socket.on('message', function(message) {
    console.log('Client received message: ', message);
    signalingMessageCallback(message);
});

socket.on('log', function(array) {
    console.log.apply(console, array);
});

socket.emit('create or join', room);

if (location.hostname.match(/lcoalhost|127\.0\.0/)) {
    socket.emit('ipaddr');
}

function updateRoomURL(ipaddr) {
    let url;
    if (!ipaddr) {
        url = location.href;
    } else {
        url = location.protocol + '//' + ipaddr + ':8080/#' + room;
    }

    roomURL.innerHTML = url;
}

function sendMessage(message) {
    console.log('Client sending message : ', message);
    socket.emit('message', message);
}





/*******************************************
 *  Webrtc peer connection and data channel
 * ******************************************/

let peerConn;
let dataChannel;

function createPeerConnection(isInitiator, config) {
    console.log('Creating Peer connection as initiator ? ', 
        isInitiator, ' config : ', config);
    
    peerConn = new RTCPeerConnection(config);

    peerConn.onicecandidate = function(event) {
        console.log('onicecandidate event: ', event);
        if (event.candidate) {
            sendMessage({
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: evnet.candidate.sdpMid,
                candidate: event.candidate.candidate
            });
        } else {
            console.log('End of candidates.');
        }
    };

    if (isInitiator) {
        console.log('Creating Data Channel');
        dataChannel = peerConn.createDataChannel('photos');
        onDataChannelCreated(dataChannel);
        console.log('Creating an offer');
        peerConn.createOffer(onLocalSessionCreated, logError);
    } else {
        peerConn.ondatachannel = function(event) {
            console.log('ondatachannel: ', event.channel);
            dataChannel = event.channel;
            onDataChannelCreated(dataChannel);
        }
    }

} 

function onDataChannelCreated(channel) {
    console.log('onDataChannelCreated:', channel);
    channel.onopen = function() {
        console.log('CHANNEL opened!');
    }
    channel.onmessage = (webrtcDetectedBrowser === 'firefox') ? 
        receiveDataFirefoxFactory() : receiveDataChromeFactory();
}

function receiveDataChromeFactory() {
    let buf, count;

    return function onmessage(event) {
        if (typeof event.data === 'string') {
            buf = window.buf = new Uint8ClampedArray(parseInt(event.data));
            count = 0;
            console.log('Expecting a total of ' + buf.byteLength + ' bytes');
            return;
        }

        let data = new Uint8ClampedArray(event.data);
        buf.set(data, count);

        count += data.byteLength;
        console.log('count: ' + count);

        if (count === buf.byteLength) {
            console.log('Done. Rendering photo');
            renderPhoto(buf);
        }
    } 
}



function receiveDataFirefoxFactory() {
    let count;
    let total;
    let parts;

    return function onmessage(event) {
        if (typeof event.data == 'string') {
            total = parseInt(event.data);
            parts = [];
            count = 0;
            console.log('Expecting a total of ' + total + ' bytes');
            return;
        }

        parts.push(event.data);
        count += event.data.size;
        console.log('Got ' + event.data.size + ' bytes(s), ' + (total - count) + ' to go. ');

        if (count == total) {
            console.log('Assembling payload');
            let buf = new Uint8ClampedArray(total);
            let compose = function(i, pos) {
                let reader = new FileReader();
                reader.onload = function() {
                    buf.set(new Uint8ClampedArray(this.result), pos);
                    if (i + 1 == parts.length) {
                        console.log('Done. Rendering photo.');
                        renderPhoto(buf);
                    } else {
                        compose(i + 1, pos + this.result.byteLength);
                    }
                };

                compose(0, 0);
            }
        }

    }
}

function onLocalSessionCreated(desc) {
    console.log('local session created: ', desc);
    peerConn.setLocalDescription(desc, function() {
        console.log('sending local desc: ', peerConn.localDescription);
        sendMessage(peerConn.localDescription);
    }, logError);
}


function signalingMessageCallback(message) {
    if (message.type === 'offer') {
        console.log('Got offer. Sending answer to peer');
        peerConn.setRemoteDescription(new RTCSessionDescription(message), function(){}, logError);
        peerConn.createAnswer(onLocalSessionCreated, logError);
    } else if (message.type === 'answer') {
        console.log('Got answer.');
        peerConn.setRemoteDescription(new RTCPeerConnection(message), function() {}, logError);
    } else if (message.type == 'candidate') {
        peerConn.addIceCandidate(new RTCIceCandidate({candidate: message.candidate}));
    } else if (message === 'bye') {

    }
 }



/**************************
 *  event
 * ************************/

function snapPhoto() {
    photoContext.drawImage(video, 0, 0, photoContextW, photoContextH);
    show(photo, sendBtn);
}

function sendPhoto() {
    let CHUNK_LEN = 64000;

    let img = photoContext.getImageData(0, 0, photoContextW, photoContextH);
    let len = img.data.byteLength;
    let n = len / CHUNK_LEN | 0;

    console.log('sending a total of ' + len + ' byte(s)');
    dataChannel.send(len);

    for (let i = 0; i < n; i++) {
        let start = i * CHUNK_LEN;
        let end = (i + 1) * CHUNK_LEN;
        console.log(start + ' - ' + (end - 1));
        dataChannel.send(img.data.subarray(start, end));
    }

    if (len % CHUNK_LEN) {
        console.log('last ' + len % CHUNK_LEN + ' byte(s)');
        dataChannel.send(img.data.subarray(n * CHUNK_LEN));
    }
}

function snapAndSend() {
    snapPhoto();
    sendPhoto();
}

function setCanvasDimensions() {
    if (video.videoWidth == 0) {
        setTimeout(setCanvasDimensions, 200);
        return;
    }

    console.log('video width: ', video.videoWidth, 'height:', video.videoHeight);
    photoContextW = video.videoWidth / 2;
    photoContextH = video.videoHeight / 2;

    photoContextW = 300;
    photoContextH = 150;
}


function renderPhoto(data) {
    let canvas = document.createElement('canvas');
    canvas.classList.add('photo');
    trail.insertBefore(canvas, trail.firstChild);

    let context = canvas.getContext('2d');
    let img = context.createImageData(photoContextW, photoContextH);
    img.data.set(data);
    context.putImageData(img, 0, 0);
}
