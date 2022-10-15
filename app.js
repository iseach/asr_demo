var logBox = document.getElementById('log-box');

const btn = document.querySelector("#btn");
const wave = document.querySelector("#wave");
const apiKey = document.querySelector("#apiKey");

var ws = null;
var record = null;

time.init();

var Recorder = function (stream) {
  var sampleBits = 16;
  var sampleRate = 8000;
  var context = new AudioContext();
  var audioInput = context.createMediaStreamSource(stream);
  var recorder = context.createScriptProcessor(4096, 1, 1);
  var audioData = {
    size: 0,
    buffer: [],
    inputSampleRate: 48000,
    inputSampleBits: 16,
    outputSampleRate: sampleRate,
    oututSampleBits: sampleBits,
    clear: function () {
      this.buffer = [];
      this.size = 0;
    },
    input: function (data) {
      this.buffer.push(new Float32Array(data));
      this.size += data.length;
    },
    compress: function () {
      var data = new Float32Array(this.size);
      var offset = 0;
      for (var i = 0; i < this.buffer.length; i++) {
        data.set(this.buffer[i], offset);
        offset += this.buffer[i].length;
      }
      var compression = parseInt(this.inputSampleRate / this.outputSampleRate);
      var length = data.length / compression;
      var result = new Float32Array(length);
      var index = 0,
      j = 0;
      while (index < length) {
        result[index] = data[j];
        j += compression;
        index++;
      }
      return result;
    },
    encodePCM: function () {
      var sampleRate = Math.min(this.inputSampleRate, this.outputSampleRate);
      var sampleBits = Math.min(this.inputSampleBits, this.oututSampleBits);
      var bytes = this.compress();
      var dataLength = bytes.length * (sampleBits / 8);
      var buffer = new ArrayBuffer(dataLength);
      var data = new DataView(buffer);
      var offset = 0;
      for (var i = 0; i < bytes.length; i++, offset += 2) {
        var s = Math.max(-1, Math.min(1, bytes[i]));
        data.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
      return new Blob([data]);
    }
  };

  var sendData = function () {
    var reader = new FileReader();
    var newNode;
    reader.onload = e => {
      var outbuffer = e.target.result;
      var arr = new Int8Array(outbuffer);
      if (arr.length > 0) {
        var tmparr = new Int8Array(1024);
        var j = 0;
        for (var i = 0; i < arr.byteLength; i++) {
          tmparr[j++] = arr[i];
          if (((i + 1) % 1024) == 0) {
            ws.send(tmparr);
            if (arr.byteLength - i - 1 >= 1024) {
              tmparr = new Int8Array(1024);
            } else {
              tmparr = new Int8Array(arr.byteLength - i - 1);
            }
            j = 0;
          }
          if ((i + 1 == arr.byteLength) && ((i + 1) % 1024) != 0) {
            ws.send(tmparr);
          }
        }
      }
    };
    reader.readAsArrayBuffer(audioData.encodePCM());
    audioData.clear();
  };

  this.start = function () {
    time.start();
    audioInput.connect(recorder);
    recorder.connect(context.destination);
  }

  this.stop = function () {
    time.stop();
    recorder.disconnect();
  }

  this.getBlob = function () {
    return audioData.encodePCM();
  }

  this.clear = function () {
    audioData.clear();
  }

  recorder.onaudioprocess = function (e) {
    var inputBuffer = e.inputBuffer.getChannelData(0);
    audioData.input(inputBuffer);
    sendData();
  }
}

function useWebSocket() {
  console.log(apiKey.value);
  ws = new WebSocket("wss://asr.nlp.ac.cn/asr");
  ws.binaryType = 'arraybuffer';
  ws.onopen = function () {
    let newNode = document.createElement('div');
    newNode.innerHTML = 'Websocket Opened.';
    logBox.appendChild(newNode);

    if (ws.readyState == 1) {
      newNode = document.createElement('div');
      newNode.innerHTML = 'Websocket Connected.';
      logBox.appendChild(newNode);

      record.start();

      newNode = document.createElement('div');
      newNode.innerHTML = 'Sending data via websocket…';
      logBox.appendChild(newNode);
    }
  };

  ws.onmessage = function (msg) {
    console.info(msg)
    let newNode = document.createElement('div');
    newNode.innerHTML = '<span style="color:red">Websocket Response: </span>';
    logBox.appendChild(newNode);
    newNode = document.createElement('div');
    newNode.innerHTML = '<span style="color:red">' + msg.data + '</span>';
    logBox.appendChild(newNode);
  }

  ws.onerror = function (err) {
    console.info(err)
    let newNode = document.createElement('div');
    newNode.innerHTML = '<span style="color:red">Websocket Error.</span>';
    logBox.appendChild(newNode);
  }

  ws.onclose = function (msg) {
    console.info(msg)
    record.stop();
    record = null;

    let newNode = document.createElement('div');
    newNode.innerHTML = 'WebSocket Closed.';
    logBox.appendChild(newNode);
  }
}

const start = function () {
  navigator.mediaDevices.getUserMedia({ audio: true })
      .then((mediaStream) => {
        record = new Recorder(mediaStream);
        useWebSocket();
      })
      .catch((error) => {
        console.log(error);
        switch (error.message || error.name) {
          case 'PERMISSION_DENIED':
          case 'PermissionDeniedError':
              console.info('Permission Denied.');
              break;
          case 'NOT_SUPPORTED_ERROR':
          case 'NotSupportedError':
              console.info('Not Supported.');
              break;
          case 'MANDATORY_UNSATISFIED_ERROR':
          case 'MandatoryUnsatisfiedError':
              console.info('Mandatory Unsatisfied.');
              break;
          default:
              console.info('Error: ' + (error.code || error.name));
              break;
        }
      }
      );
}

const stop = function () {
  if (ws) {
      ws.close();
  }
  time.stop()
}

btn.addEventListener("click", ()=>{
  if (btn.getAttribute("src") == "stop.svg") {
    start();
    btn.setAttribute("src", "start.svg");
    wave.style.display = "block";
  } else {
    stop();
    btn.setAttribute("src", "stop.svg");
    wave.style.display = "none";
  }
});
