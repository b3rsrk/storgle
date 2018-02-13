window.storgle = (function() {
  let provider_index = 0
  let chunks = undefined
  let transactions = undefined
  let transaction_index = 0
  let bundle = undefined
  let upload_filename = ''
  let download_hash = ''
  let password_key = undefined
  var providers = [
    "https://iotanode.us:443",
    "https://node.iota.dance:443",
    "https://nodes.iota.cafe:443",
    "https://iri2-api.iota.fm:443",
    "https://nelson1-api.iota.fm:443",
    "https://node.neffware.com:443",
    "https://wallet1.iota.town:443",
  ]
  const tryteAlphabet = '9ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const eventEmitter = new EventEmitter()

  function initialize() {
    eventEmitter.emitEvent('log', [`Initializing connection to node at ${providers[provider_index]}.`])
    iota = new IOTA({'provider': providers[provider_index]})
  }

  function reinitialize(method) {
    provider_index = (provider_index + 1) % providers.length
    initialize();
    verifyNode(method);
  }

  function verifyNode(method) {
    eventEmitter.emitEvent('log', ['Checking if node is synced.'])

    iota.api.getNodeInfo(function(error, success){
      if(error) {
        eventEmitter.emitEvent('log', ['Error occurred while checking if node is synced.'])
        setTimeout(function(){
          reinitialize(method)
        }, 1000)
        return
      }

      if(success.latestSolidSubtangleMilestoneIndex >= success.latestMilestoneIndex) {
        eventEmitter.emitEvent('log', ['Node is synced.'])
        method();
      } else {
        eventEmitter.emitEvent('log', [`Node is not synced. Trying an other node.`])
        setTimeout(function(){
          reinitialize(method)
        }, 1000)
      }
    })
  }

  function toTrytes(buffer) {
    let view = new Uint8Array(buffer);

    if(password_key != undefined)
      view = new aesjs.ModeOfOperation.ctr(password_key, new aesjs.Counter(5)).encrypt(view);

    var str = '';

    for (var i = 0; i < view.length; i++) {
      var firstValue = view[i] % 27;
      var secondValue = (view[i] - firstValue) / 27;
      str += tryteAlphabet[firstValue] + tryteAlphabet[secondValue];
    }

    return str
  }

  function fromTrytes(inputTrytes) {
    let view = new Uint8Array(inputTrytes.length/2);

    for (var i = 0; i < inputTrytes.length; i+=2) {
      var trytes = inputTrytes[i] + inputTrytes[i + 1];
      var firstValue = tryteAlphabet.indexOf(trytes[0]);
      var secondValue = tryteAlphabet.indexOf(trytes[1]);
      view[i/2] = firstValue + secondValue * 27;
    }

    if(password_key != undefined)
      view = new aesjs.ModeOfOperation.ctr(password_key, new aesjs.Counter(5)).decrypt(view);

    return btoa(String.fromCharCode.apply(null, view));
  }

  function setPassword(password) {
    if(password != '') {
      password_key = sha256.update(password).array();
    } else {
      password_key = undefined;
    }
  }

  function rtrim(char, str) {
    if (str.slice(str.length - char.length) === char) {
      return rtrim(char, str.slice(0, 0 - char.length));
    } else {
      return str;
    }
  }

  function convertFilenameToTag(filename) {
    filename = filename.toUpperCase()
    output = ''

    for (var i = 0; i < filename.length; i++) {
      if(filename[i] == '9') {
        continue
      } else if(tryteAlphabet.indexOf(filename[i]) >= 0) {
        output += filename[i];
      } else if(filename[i] == '.') {
        output += '999';
      }
    }

    if(output.length > 27) {
      return output.substr(output.length - 27, 27)
    } else {
      return output
    }
  }

  function convertFilenameFromTag(tag) {
    return rtrim('9', tag).toLowerCase().replace("999", ".");
  }

  function transfer_chunk() {
    eventEmitter.emitEvent('log', [`Processing transaction #${transaction_index}.`])

    iota.api.sendTrytes([transactions[transaction_index]], Math.floor(Math.random() * (12 - 4 + 1)) + 4, 14, function(error, success){
      if (error) {
        eventEmitter.emitEvent('log', [`Error occurred while sending transactions: ${error}`])
        setTimeout(function(){
          reinitialize(transfer_chunk)
        }, 1000)
        return
      }

      transaction_index++
      bundle = success[0].bundle;
      eventEmitter.emitEvent('progress', [Math.ceil((transaction_index)/transactions.length*100)])
      eventEmitter.emitEvent('bundle', [bundle])
      eventEmitter.emitEvent('log', [`Commited transaction ${success[0].hash}`])
      if(transaction_index != transactions.length) {
        transfer_chunk();
      } else {
        eventEmitter.emitEvent('log', [`Upload complete.`])
      }
    });
  }

  function provide_download(filename, base64) {
    var pom = document.createElement('a');
    pom.setAttribute('href', 'data:application/octet-stream;charset=utf-8;base64,' + base64);
    pom.setAttribute('download', filename);

    if (document.createEvent) {
      var event = document.createEvent('MouseEvents');
      event.initEvent('click', true, true);
      pom.dispatchEvent(event);
    }
    else {
      pom.click();
    }
  }

  function start_upload() {
    seed = Array.from(new Array(81), (x, i) => tryteAlphabet[Math.floor(Math.random() * tryteAlphabet.length)]).join('');
    transfers = []
    for (i = 0; i < chunks.length; i++) {
      transfers.push({
        address: seed,
        value: 0,
        message: chunks[i],
        tag: convertFilenameToTag(upload_filename)
      });
    }

    iota.api.prepareTransfers(seed, transfers, function(error, success){
      if (error) {
        eventEmitter.emitEvent('log', [`Error occurred while preparing transactions: ${error}`])
        setTimeout(function(){
          reinitialize(start_upload)
        }, 1000)
        return
      }

      transactions = success
      transaction_index = 0
      transfer_chunk()
    });
  }

  function start_download() {
    iota.api.findTransactionObjects({'bundles': [download_hash]}, function(error, success){
      if (error) {
        eventEmitter.emitEvent('log', [`Error occurred while searching transactions: ${error}`])
        setTimeout(function(){
          reinitialize(start_download)
        }, 1000)
        return
      }

      if(success[0].lastIndex != success.length-1) {
        eventEmitter.emitEvent('log', [`Error occurred while searching transactions: Incomplete list of transactions!`])
        setTimeout(function(){
          reinitialize(start_download)
        }, 1000)
        return
      }

      tmp = ''
      for (var x = 0; x < success.length; x++) {
        for (var y = 0; y < success.length; y++) {
          if(success[y].currentIndex == x) {
            tmp += success[y].signatureMessageFragment
            eventEmitter.emitEvent('progress', [Math.ceil((x+1)/success.length*100)])
          }
        }
      }

      tmp = rtrim('9', tmp)
      provide_download(convertFilenameFromTag(success[0].tag), fromTrytes(tmp));
    });
  }

  return {
    upload: function(filename, buffer, password) {
      eventEmitter.emitEvent('log', ['Start uploading.'])
      setPassword(password);
      trytes = toTrytes(buffer)
      chunks = trytes.match(/.{1,2187}/g)
      transactions = undefined
      transaction_index = 0
      bundle = undefined
      upload_filename = filename
      eventEmitter.emitEvent('log', [`Splitting file into ${chunks.length} chunks.`])

      initialize();
      verifyNode(start_upload);
    },
    download: function(hash, password) {
      eventEmitter.emitEvent('log', ['Start downloading.'])
      download_hash = hash

      setPassword(password);
      initialize();
      verifyNode(start_download);
    },
    setProviders: function(input) {
      providers = input
    },
    eventEmitter: eventEmitter,
    providers: providers
  }
})()
