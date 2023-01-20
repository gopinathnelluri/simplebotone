const express = require('express');
const app = express();

// Define an endpoint for retrieving alerts
app.get('/buy', (req, res) => {
  // Placeholder for alerts data
  let alerts = [
    { type: 'buy', price: 100 }
  ];
  
  // Send the alerts data as a response
  res.json(alerts);
});


// Define an endpoint for retrieving alerts
app.get('/sell', (req, res) => {
    // Placeholder for alerts data
    let alerts = [
      { type: 'sell', price: 80 }
    ];
    
    // Send the alerts data as a response
    res.json(alerts);
  });

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});