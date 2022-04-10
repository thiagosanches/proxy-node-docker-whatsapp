const express = require('express')
const { exec } = require('child_process');

const app = express()

app.post('/sendMessage', function (req, res) {
  
  exec('java -jar /home/whatsapp/sikulixide-2.0.5.jar -r /home/whatsapp/app/sikulixide.template.py', (error, stdout, stderr) =>{
    if(error){
      console.log(error)
    }

    if(stderr){
      console.log(stderr)
    }
    
    console.log(stdout)
  })
  
})

app.listen(3000)
