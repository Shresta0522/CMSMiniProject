var express=require("express")
var bodyParser=require("body-parser")
var mongoose=require("mongoose")
const path = require('path');
const multer = require('multer');
const methodOverride = require('method-override');

const app=express()

app.use(bodyParser.json())
app.use(express.static('public'))
app.use('/uploads', express.static('uploads'));
app.use(bodyParser.urlencoded({
    extended:true
}))

// Set up multer for handling file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });
  

// Override with POST having ?_method=DELETE
app.use(methodOverride('_method'));

mongoose.connect('mongodb://localhost:27017/CMS-DB')
var db=mongoose.connection
db.on('error',()=> console.log("Error in Connecting to Database"))
db.once('open',()=> console.log("Connected to Database"))

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));



const usersDetailsSchema = new mongoose.Schema({
    name: String,
    email:String,
    phone:String,
    role:String,
    password:String,
    confirmPassword:String,

})


const UsersDetails = mongoose.model('usersDetails',usersDetailsSchema);

const pageDetailsSchema = new mongoose.Schema ({
    pageTitle : String,
    pagecontent : String,
    media : String,
    pagefooter:String,
})
const PageDetails = mongoose.model('pageDetails',pageDetailsSchema);

app.post('/createpage',upload.single('media'),(req,res) =>{
    // Check if multer successfully parsed the file upload
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }
    var pageTitle = req.body.pageTitle
    var pageContent = req.body.pageContent
    var media = req.file.filename
    var pageFooter = req.body.pageFooter
    
    const newPageDetails = new PageDetails ({
        pageTitle : pageTitle , 
        pagecontent : pageContent ,
        media : media ,
        pagefooter : pageFooter
    })
    db.collection('pageDetails').insertOne(newPageDetails,(err,collection) => {
        if(err){
            throw err;
        }
        console.log("Page Inserted Succesfully")
    })
    return res.redirect('adminhome.html')

});

app.get('/pages',async (req,res) =>{
    try {
        db.collection('pageDetails').find({}).toArray()
        .then(pages => {
            console.log("Page details:", pages);
            res.render('pages', { pages });
        })
      } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
      }
})

app.get('/eachpage/:pageTitle', async (req, res) => {
    try {
      db.collection('pageDetails').findOne({pageTitle: req.params.pageTitle })
        .then((eachpage) => {
          if (!eachpage) {
            console.log(`Page Title is ${req.params.pageTitle} not found`);
            return res.status(404).send('User not found');
          }
          console.log(` ${req.params.name}  found`);
          res.render('eachpage', { eachpage });
        })
      
    } catch (err) {
      console.error('Error retrieving user details:', err);
      res.status(500).send('Internal Server Error');
    }
});


app.post('/page/delete/:pageTitle', async (req, res) => {
    try{
        const result = await db.collection('pageDetails').deleteOne({ pageTitle: req.params.pageTitle })
        
        if(!result.deletedCount){
            throw new Error('No document found!')
        }
        else{
            console.log(`Deleted Page: ${req.params.pageTitle}`);
            res.redirect('/pages')
        }

    }catch (err) {
        console.error('Error deleting page details:', err);
        res.status(500).send('Internal Server Error');
      }
})

app.get('/page/edit/:pageTitle',async (req, res) => {
    try{
        db.collection('pageDetails').findOne({pageTitle: req.params.pageTitle })
        .then((page) => {
          if (!page) {
            console.log(`Page with ID ${req.params.pageTitle} not found`);
            return res.status(404).send('Page not found');
          }
          console.log(` ${req.params.pageTitle}  found`);
          res.render('editPage', { page });
        })

    }catch (err) {
      console.error('Error retrieving and edit user details:', err);
      res.status(500).send('Internal Server Error');
    }
})

app.post('/page/edit/:pageTitle', upload.single('media'), (req, res) => {
    const newPage ={
        pageTitle : req.body.pageTitle,
        pageContent : req.body.pageContent,
        media : req.file.filename,
        pageFooter : req.body.pageFooter,
    }
    try{
        db.collection('pageDetails').updateOne({ pageTitle : req.params.pageTitle},{ $set: newPage }, (err, result) => {
            if (err) return console.error(err);
            console.log('Document updated');
            res.redirect('/pages');
        })
    } catch (err) {
        console.error('Error editing Page details:', err);
      res.status(500).send('Internal Server Error');
    }
})


//User Related Content
app.post("/sign_up",(req,res) => {
    var name= req.body.name
    var email=req.body.email
    var phone=req.body.phone
    var password=req.body.password
    var confirmPassword=req.body.confirmPassword
    var role="user"

    if (password===confirmPassword){
        var data=new UsersDetails ({
            name : name , 
            email : email ,  
            phone : phone ,  
            password : password , 
            role :role
            })
        // Save User to database
        db.collection('usersDetails').insertOne(data,(err,collection) => {
            if(err){
                throw err;
            }
            console.log("Record Inserted Succesfully")
        })
        return res.redirect('/login')
    }else{
        res.send("Passwords do not match")
    }
});

// Endpoint to handle login
app.post('/login', async (req, res) => {
    try {
        db.collection('usersDetails').findOne({ name: req.body.name  }) 
        .then(user => {
            if (user && user.password === req.body.password) {
                // If username and password match, redirect to home page
                if(user &&  user.role==='admin'){
                    res.redirect('adminhome.html');
                } else {
                    res.redirect('/pages');

                }
                
            } else {
                res.send('Invalid username or password');
            }
        })
        // res.redirect('login')
    } catch (error) {
        console.error('Error finding user:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get("/users",async (req,res)=>{
    try {
        db.collection('usersDetails').find({}).toArray()
        .then(users => {
            // console.log("User details:", users);
            res.render('users', { users });
        })
      } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
      }
});

app.get('/user/:name', async (req, res) => {
    try {
      db.collection('usersDetails').findOne({name: req.params.name })
        .then((user) => {
          if (!user) {
            console.log(`User with ID ${req.params.name} not found`);
            return res.status(404).send('User not found');
          }
          console.log(` ${req.params.name}  found`);
          res.render('user', { user });
        })
      
    } catch (err) {
      console.error('Error retrieving user details:', err);
      res.status(500).send('Internal Server Error');
    }
  });

app.post('/user/delete/:name', async (req, res) => {
    try{
        const result = await db.collection('usersDetails').deleteOne({ name : req.params.name})
        
        if(!result.deletedCount){
            throw new Error('No document found!')
        }
        else{
            console.log(`Deleted User: ${req.params.name}`);
            res.redirect('/users')
        }

    }catch (err) {
      console.error('Error deleting user details:', err);
      res.status(500).send('Internal Server Error');
    }
});

app.get('/user/edit/:name',async (req, res) => {
    try{
        db.collection('usersDetails').findOne({name: req.params.name })
        .then((user) => {
          if (!user) {
            console.log(`User with ID ${req.params.name} not found`);
            return res.status(404).send('User not found');
          }
          console.log(` ${req.params.name}  found`);
          res.render('editUser', { user });
        })


    }catch (err) {
      console.error('Error retrieving and edit user details:', err);
      res.status(500).send('Internal Server Error');
    }
})

app.post('/user/edit/:name',async (req, res) => {
    const newData = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        role:    req.body.role,
        password: req.body.password
    }
    try{
        db.collection('usersDetails').updateOne({ name : req.params.name},{ $set: newData }, (err, result) => {
            if (err) return console.error(err);
            console.log('Document updated');
            res.redirect('/users');
        })

    } catch (err) {
        console.error('Error editing user details:', err);
      res.status(500).send('Internal Server Error');
    }
})

  app.get('/login', (req, res) => {
    res.set({
        "Allow-acces-Allow-Origin":'*'
    })
    return res.redirect('login.html')
})

app.get('/adminhomepage', (req, res) => {
    res.set({
        "Allow-acces-Allow-Origin":'*'
    })
    return res.render('adminhome.html')
    
})

app.get("/",(req,res) => {
    res.set({
        "Allow-acces-Allow-Origin":'*'
    })
    return res.redirect('index.html')
}).listen(3000);
console.log("Listening on port 3000");