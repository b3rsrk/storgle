var app = new Vue({
  el: '#app',
  data: {
    progress1Visible: false,
    progress2Visible: false,
    progressText: '',
    progressValue: 0,
    logVisible: true,
    logText: 'Hide Log',
    log: '',
    locked: false,
    uploadedToken: '',
    uploadedLink: '',
    filename: '',
    hash: '',
    uploadPassword: '',
    downloadPassword: '',
    providers: storgle.providers.join("\n")
  },
  mounted: function () {
    params = this.getQueryParams(document.location.search)
    if(params['hash'] !== undefined) {
      this.hash = params['hash']
      if(params['password'] !== undefined) {
        $('#passwordModal').modal({backdrop: 'static', keyboard: false})
      } else {
        this.download()
      }
    }
  },
  created: function() {
    storgle.eventEmitter.addListener('log', this.log_listener);
    storgle.eventEmitter.addListener('progress', this.progress_listener);
    storgle.eventEmitter.addListener('bundle', this.bundle_listener);
    card1_height = $('#card1').height();
    card2_height = $('#card2').height();

    diff = Math.max(card1_height, card2_height) - Math.min(card1_height, card2_height);
    if(card1_height == Math.min(card1_height, card2_height)) {
      $('#fill1').height(diff);
    } else {
      $('#fill2').height(diff);
    }
  },
  methods: {
    log_listener: function (text) {
      this.log += '[' + new Date().toLocaleString() + '] ' + text + '\n';
    },
    bundle_listener: function (bundle) {
      this.uploadedToken = bundle;
      this.uploadedLink = location.protocol + '//' + window.location.hostname + '/?hash=' + this.uploadedToken;
      if(this.uploadPassword != '') {
        this.uploadedLink += '&password=1'
      }
    },
    progress_listener: function (value) {
      this.progress_value = value;
      if(value >= 10) {
        this.progress_text = value + '%'
      }

      if(value == 100) {
        if(this.progress1Visible) {
          $('#successModal').modal({backdrop: 'static', keyboard: false})
        }
        this.progress1Visible = false;
        this.progress2Visible = false;
        this.locked = false;
      }
    },
    getQueryParams: function(qs) {
        qs = qs.split('+').join(' ');
        var params = {}, tokens, re = /[?&]?([^=]+)=([^&]*)/g;
        while (tokens = re.exec(qs)) {
          params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
        }

        return params;
    },
    saveSettings: function (event) {
      storgle.setProviders(this.providers.split('\n'))
    },
    loadSettings: function (event) {
      this.providers = storgle.providers.join("\n")
      $('#optionsModal').modal({backdrop: 'static', keyboard: false})
    },
    upload_wrapper: function (event) {
      if(this.buffer === undefined) {
        $('#errorModal').modal({backdrop: 'static', keyboard: false})
        return
      }

      $('#warningModal').modal({backdrop: 'static', keyboard: false})
    },
    upload: function (event) {
      this.progressText = '';
      this.progressValue = 0;
      this.progress1Visible = true;
      this.locked = true;

      storgle.upload(this.filename, this.buffer, this.uploadPassword);
    },
    download: function (event) {
      this.progressText = '';
      this.progressValue = 0;
      this.progress2Visible = true;
      this.locked = true;

      storgle.download(this.hash, this.downloadPassword);
    },
    toggleLog: function (event) {
      if(this.logVisible) {
        this.logVisible = false;
        this.logText = 'Show Log';
      } else {
        this.logVisible = true;
        this.logText = 'Hide Log';
      }
    },
    onFileChange(e) {
      var files = e.target.files || e.dataTransfer.files;
      if (!files.length)
        return;

      var reader = new FileReader();
      reader.onload = (e) => {
        this.buffer = e.target.result;
      };
      this.filename = files[0].name;
      reader.readAsArrayBuffer(files[0]);
    }
  }
})
