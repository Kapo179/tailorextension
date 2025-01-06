const s="https://cv-extension-461e802f9c0c.herokuapp.com";chrome.runtime.onMessage.addListener((e,n,t)=>{if(e.action==="TAILOR_CV")return a(e.jobDescription,e.userCV)?(c(e.jobDescription,e.userCV).then(r=>t(r)).catch(r=>t({error:r.message})),!0):(t({error:"Invalid input data"}),!0)});function a(e,n){return typeof e=="string"&&typeof n=="string"&&e.length>0&&n.length>0&&e.length<5e4&&n.length<5e4}async function c(e,n){try{const t=await fetch(`${s}/api/tailor`,{method:"POST",headers:{"Content-Type":"application/json","X-Client-Version":chrome.runtime.getManifest().version},body:JSON.stringify({jobDescription:i(e),userCV:i(n)})});if(!t.ok){const o=await t.text();throw new Error(o||"Failed to tailor CV")}const r=await t.json();return{...r,feedback:l(r)}}catch(t){throw console.error("Error:",t),t}}function i(e){return e.trim().replace(/[<>]/g,"").slice(0,5e4)}function l(e){const n=e.matchedSkills||[],t=e.missingSkills||[];return{matched:n,missing:t,score:h(n,t),recommendations:m(n,t)}}function h(e,n){const t=e.length+n.length;return t>0?e.length/t*100:0}function m(e,n){const t=[];return n.length>0&&t.push({type:"skills_gap",message:`Consider adding these skills: ${n.slice(0,3).join(", ")}`,priority:"high"}),e.length<5&&t.push({type:"emphasis_needed",message:"Your CV could benefit from emphasizing more relevant skills",priority:"medium"}),t}