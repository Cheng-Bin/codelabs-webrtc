'use strict';


let sendChannel, receiveChannel;          // video tags
let startButton, sendButton, closeButton;  // button tags
let dataChannelSend, dataChannelReceive;
let localPeerConnection, remotePeerConnection;

window.onload = function() {

    getElements();
    addEvent();
    initButton();

};


// 获取所有tag
function getElements() {
    startButton = document.getElementById('startButton');
    sendButton = document.getElementById('sendButton');
    closeButton = document.getElementById('closeButton');

    dataChannelSend = document.getElementById('dataChannelSend');
    dataChannelReceive = document.getElementById('dataChannelReceive');
}


// 初始化button
function initButton() {
    startButton.disabled = false;
    sendButton.disabled = true;
    closeButton.disabled = true;
}

// 添加event事件
function addEvent() {
    startButton.onclick = createConnection;
    sendButton.onclick = sendData;
    closeButton.onclick = closeDataChannels;
}


function createConnection() {
    var servers = null;

    localPeerConnection = new RTCPeerConnection(servers, {optional: [{RtcDataChannels: true}]});

    trace('Created local peer connection object localPeerConnection');

    try {
        sendChannel = localPeerConnection.createDataChannel('sendDataChannel', {reliable: false});
        trace('Created send data channel');
    } catch (e) {
        alert('Failed to create data channel. You need Chrome 25 or later with RtpDataChannel enabled' );
        trace('createDataChannel() failed with exception : ' + e.message);
    }

    localPeerConnection.onicecandidate = gotLocalIceCandidate;
    sendChannel.onopen = handleSendChannelStateChange;
    sendChannel.onclose = handleSendChannelStateChange;


    remotePeerConnection = new RTCPeerConnection(servers, {optional: [{RtcDataChannels: true}]});
    trace('Created remote peer connection object remotePeerConnection');
    remotePeerConnection.onicecandidate = gotRemoteIceCandidate;
    remotePeerConnection.ondatachannel = gotReceiveChannel;

    localPeerConnection.createOffer(getLocalDescription, handleError);
    startButton.disabled = true;
    closeButton.disabled = false;
}


function sendData() {
    var data = document.getElementById('dataChannelSend').value;
    sendChannel.send(data);
    trace('Send data:' + data);
}


function closeDataChannels() {
    trace('Closing data channels');
    
    sendChannel.close();
    trace('Close data channel with label: ' + sendChannel.label);
    
    receiveChannel.close();
    trace('Close data channel with label: ' + receiveChannel.label);

    localPeerConnection.close();
    remotePeerConnection.close();
    localPeerConnection = null;
    remotePeerConnection = null;
    trace('Close peer connections');

    startButton.disabled = false;
    sendButton.disabled = true;
    closeButton.disabled = true;

    dataChannelSend.value = '';
    dataChannelReceive.value = '';
    dataChannelSend.disabled = true;
    dataChannelSend.placeholder = 'Press start, enter some text, then press Send';
}


function gotLocalIceCandidate(event) {
    trace('Local ice callback');

    if (event.candidate) {
        remotePeerConnection.addIceCandidate(event.candidate);
        trace('local ICE  candidate : \n' + event.candidate.candidate);
    }
}

function gotRemoteIceCandidate(event) {
    trace('remote ice callback');
    if (event.candidate) {
        localPeerConnection.addIceCandidate(event.candidate);
        trace('Remote ICE candidate: \n ' + event.candidate.candidate);
    }
}


function handleSendChannelStateChange() {
    var readyState = sendChannel.readyState;

    if (readyState == 'open') {
        dataChannelSend.disabled = false;
        dataChannelSend.focus();
        dataChannelSend.placeholder = '';
        sendButton.disabled = false;
        closeButton.disabled = false;
    } else {
        dataChannelSend.disabled = true;
        sendButton.disabled = true;
        closeButton.disabled = true;
    }

}

function gotReceiveChannel(event) {
    trace('Receive channel callback');

    receiveChannel = event.channel;
    receiveChannel.onmessage = handleMessage;
    receiveChannel.onopen = handleReceiveChannelStateChange;
    receiveChannel.onclose = handleReceiveChannelStateChange;
}

function handleMessage(event) {
    trace('Received message: ' + event.data);
    document.getElementById('dataChannelReceive').value = event.data;
}

function handleReceiveChannelStateChange() {
    var state = receiveChannel.readyState;
    trace('receive channel state is : ' + state);
}

function getLocalDescription(desc) {
    localPeerConnection.setLocalDescription(desc);
    trace('Offer from localPeerConnection \n ' + desc.sdp);
    remotePeerConnection.setRemoteDescription(desc);
    remotePeerConnection.createAnswer(getRemoteDescription, handleError);
} 

function getRemoteDescription(desc) {
    remotePeerConnection.setLocalDescription(desc);
    trace('Answer from  remotePeerConnection \n ' + desc.sdp);
    localPeerConnection.setRemoteDescription(desc);
}


function trace(text) {
    console.log((performance.now() / 1000).toFixed(3) + ':' + text);
}

function handleError() {

}