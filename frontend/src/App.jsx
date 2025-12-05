import { useState , useEffect } from 'react'
import"prismjs/themes/prism-tomorrow.css"
import Editor from 'react-simple-code-editor'
import prism from "prismjs"
import axios from "axios"
import './App.css'
import { use } from 'react'

function App() {
  const [count, setCount] = useState(0)
  const [code, setCode] = useState('function helloWorld() {\n  console.log("Hello, world!");\n}\n\nhelloWorld();')

  const [review, setReview] = useState('')
  useEffect(() => {
    prism.highlightAll();
  } )

   async function reviewCode() {
    const response = await axios.post('http://localhost:3000/ai/get-review', { code})
      setReview(response.data)
   
   }

  return (
    <>
     <main>
       <div className = "left">
        <div className="code">
          <Editor
            value={code}
            onValueChange={code => setCode(code)}
            highlight={code =>prism.highlight(code, prism.languages.js, 'js')}
            padding={10}
            style={{
              fontFamily: '"Fira code", "Fira Mono", monospace',
              fontSize: 12,
             borderRadius: "8px",
             border: "1px solid #ddd",
              color: "#f8f8f2",
              height : "100%", 
              width : "100%",

            }}
          />

        </div>
        <div  
        onClick={reviewCode}
        className="review">Review</div>
       </div>
       <div className = "right">
        review
       </div>
     </main>
    </>
  )
}



export default App
