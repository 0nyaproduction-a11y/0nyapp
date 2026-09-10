const fs = require('fs');
const path = 'src/lib/cms/form-wrapper.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /import React from "react";/m,
  `import React from "react";\n\ndeclare global {\n  interface Window {\n    __formWrapperError?: string;\n    __formWrapperTargets?: number;\n    __formWrapperSuccess?: string;\n  }\n}\n`
);

content = content.replace(
  /\(window as Record<string, unknown>\)\.__formWrapperError = `formRef null for \${formId}`;/g,
  'window.__formWrapperError = `formRef null for ${formId}`;'
);

content = content.replace(
  /\(window as Record<string, unknown>\)\.__formWrapperTargets = targets\.length;/g,
  'window.__formWrapperTargets = targets.length;'
);

content = content.replace(
  /\(window as Record<string, unknown>\)\.__formWrapperSuccess = `listeners attached for \${formId}`;/g,
  'window.__formWrapperSuccess = `listeners attached for ${formId}`;'
);

fs.writeFileSync(path, content, 'utf8');
console.log('done');
