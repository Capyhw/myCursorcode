/* eslint-disable @typescript-eslint/naming-convention */

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
  // 获取了vscode对象，该对象用于与VS Code主API进行通信
  const vscode = acquireVsCodeApi();
  // 设置了marked库的选项，用于渲染Markdown文本。
  marked.setOptions({
    renderer: new marked.Renderer(),
    gfm: true,
    tables: true,
    breaks: false,
    pedantic: false,
    sanitize: false,
    smartLists: true,
    smartypants: false,
    //使用 highlight 插件解析文档中代码部分
    highlight: function (code, lang) {
      return hljs.highlightAuto(code, [lang]).value;
    }
  });



  let receiveData = {
    msgType: 'freeform',
    fileName: 'js'
  };

  // 监听来自扩展程序的消息
  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.type) {
      case "addQuestion": {
        receiveData = message;
        addQuestion(message.value);
        break;
      }
      case "addAnswer": {
        addAnswer(message.value);
        break;
      }
      case "showInput": {
        showInput(true, message.value);
        break;
      }
    }
  });

  let stopBtn = document.getElementById('stop-response');
  let clearBtn = document.getElementById('clear-msg');
  // let loginBtn = document.getElementById('login-btn');

  stopBtn.addEventListener('click', function (e) {
    showInput(true, "已经结束响应，请开始新的问答...");
    // 取消请求
    vscode.postMessage({
      type: 'cancel'
    });
  });

  clearBtn.addEventListener('click', function (e) {
    vscode.postMessage({
      type: 'clear'
    });
    document.getElementById("chat-box").innerHTML = '';
  });


  // 显示文本
  function showInput(type, msg) {
    let box = document.getElementById('bottom-box');
    let input = document.getElementById('prompt-input');
    if (type) {
      if (msg) {
        let ele_div = document.querySelector('.chat-answer:last-child');
        ele_div.innerText = msg;
      }
      box.style.pointerEvents = 'all';
      stopBtn.style.display = 'none';
    } else {
      box.style.pointerEvents = 'none';
      input.value = '';
      input.blur();
      stopBtn.style.display = 'block';
    }
  }

  function createElement(className) {
    let ele_div = document.createElement('div');
    ele_div.className = className;
    document.getElementById("chat-box").appendChild(ele_div);
    return ele_div;
  }
  //提问
  function addQuestion(message) {
    // 禁止输入
    showInput(false);
    let ele_div = createElement('chat-question');
    ele_div.innerText = message;
    let ele_div_answer = createElement('chat-answer');
    ele_div_answer.innerText = '正在思考中...';
    window.scrollTo(0, document.body.scrollHeight);
  }
  // 将答案添加到聊天框
  function addAnswer(content) {
    // 根据文件名设置代码块的语言
    if (receiveData.msgType !== 'freeform') {
      const fileSplit = receiveData.fileName.split('.');
      const lang = fileSplit[fileSplit.length - 1];
      content = '```' + lang + '\n' + content + '\n```';
    }

    html = marked.parse(content);
    ele_div = document.querySelector('.chat-answer:last-child');
    ele_div.innerHTML = html;
    // 下面是对代码块加入复制和插入代码的功能
    const preBlocks = ele_div.querySelectorAll('pre');
    if (preBlocks.length !== 0) {
      const lastItem = preBlocks[preBlocks.length - 1];
      lastItem.insertAdjacentHTML('afterbegin',
        `<div class="code-tool">
            <a class="copy-btn" href="javascript:;">复制代码</a>
            <a class="insert-btn" href="javascript:;">插入代码</a>
         </div>`
      );
      let copyBtn = lastItem.querySelector('.copy-btn');
      let insertBtn = lastItem.querySelector('.insert-btn');
      let codeText = lastItem.querySelector('code').innerText;
      // 复制代码
      copyBtn.addEventListener('click', function (e) {
        e.preventDefault();
        navigator.clipboard.writeText(codeText);
      });
      // 插入代码
      insertBtn.addEventListener('click', function (e) {
        e.preventDefault();
        vscode.postMessage({
          type: 'codeSelected',
          value: codeText
        });
      });
    }

    //滚动到底部
    window.scrollTo(0, document.body.scrollHeight);
    // 回答完成，解除禁止输入
    showInput(true);
    //让输入框获得焦点
    document.getElementById('prompt-input').focus();
  }
  // 监听输入框的回车事件
  document.getElementById('prompt-input').addEventListener('keyup', function (e) {
    if (e.key === 'Enter') {
      vscode.postMessage({
        type: 'prompt',
        value: this.value
      });
    }
  });
})();