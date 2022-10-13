var begin = document.getElementById('begin-btn');
var end = document.getElementById('end-btn');
var logBox = document.getElementById('log-box');

var ws = null;
var record = null;

time.init();

var Recorder = function (stream) {
    var sampleBits = 16; //输出采样数位 8, 16
    var sampleRate = 8000; //输出采样率
    var context = new AudioContext();
    var audioInput = context.createMediaStreamSource(stream);
    var recorder = context.createScriptProcessor(4096, 1, 1);
    var audioData = {
        size: 0, //录音文件长度
        buffer: [], //录音缓存
        inputSampleRate: 48000, //输入采样率
        inputSampleBits: 16, //输入采样数位 8, 16
        outputSampleRate: sampleRate, //输出采样数位
        oututSampleBits: sampleBits, //输出采样率
        clear: function () {
            this.buffer = [];
            this.size = 0;
        },
        input: function (data) {
            this.buffer.push(new Float32Array(data));
            this.size += data.length;
        },
        compress: function () { //合并压缩
            //合并
            var data = new Float32Array(this.size);
            var offset = 0;
            for (var i = 0; i < this.buffer.length; i++) {
                data.set(this.buffer[i], offset);
                offset += this.buffer[i].length;
            }
            //压缩
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
        encodePCM: function () { //这里不对采集到的数据进行其他格式处理，如有需要均交给服务器端处理。
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
        audioData.clear();//每次发送完成则清理掉旧数据
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
    ws = new WebSocket("ws://192.168.1.33:8080/asr");
    ws.binaryType = 'arraybuffer'; //传输的是 ArrayBuffer 类型的数据
    ws.onopen = function () {
        let newNode = document.createElement('div');
        newNode.innerHTML = 'Websocket Opened.';
        logBox.appendChild(newNode);

        if (ws.readyState == 1) { //ws进入连接状态
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

begin.onclick = function () {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia;
    if (!navigator.getUserMedia) {
        alert('Unsupported Browser.');
    } else {
        navigator.getUserMedia({ audio: true },
            function (mediaStream) {
                record = new Recorder(mediaStream);
                useWebSocket();
            },
            function (error) {
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
        )
    }
}

end.onclick = function () {
    if (ws) {
        ws.close();
    }
}
