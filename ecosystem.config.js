pm2_logrotate: {
  dateFormat: 'YYYY-MM-DD',
  rotateInterval: '1d',
  files: [{
    source: 'metrics.log',
    compress: 'gzip',
    keep: 3
  }]
}