import * as vscode from "vscode";
import { IChatList, RESPONSE, getChatList, source } from "./api";

type ResponseType =
  | "idk"
  | "freeform"
  | "generate"
  | "edit"
  | "chat_edit"
  | "lsp_edit";

export function activate(context: vscode.ExtensionContext) {
  console.log('your extension "GGcopilot" is now active!🎉');

  const provider = new CursorWebviewViewProvider(
    context.extensionUri,
    context.extensionPath
  );
  // 注册 WebView 视图的提供者：
  const curosrDispose = vscode.window.registerWebviewViewProvider(
    "GGcopilot.chatView",
    provider,
    {
      webviewOptions: { retainContextWhenHidden: true },
    }
  );
  // 注册命令
  const generationDispose = vscode.commands.registerTextEditorCommand(
    "GGcopilot.generation",
    (editor: vscode.TextEditor) => {
      vscode.window
        .showInputBox({
          prompt: "主人，您有何吩咐?",
          placeHolder: "请帮我生成/优化/审查...",
        })
        .then((value) => {
          const selected = editor.document.getText(editor.selection);
          if (value) {
            provider.message = value!;
            if (selected) {
              provider.msgType = "edit";
              provider.message += `\n${selected}`;
            } else {
              provider.msgType = "generate";
            }
            provider.conversation();
          }
        });
    }
  );
  // 注册命令
  const conversationDispose = vscode.commands.registerTextEditorCommand(
    "GGcopilot.conversation",
    (editor: vscode.TextEditor) => {
      vscode.window
        .showInputBox({
          prompt: "主人，您有什么问题吗?",
          placeHolder: "帮我解释一下这段代码...",
        })
        .then((value) => {
          provider.msgType = "freeform";
          if (value) {
            provider.message = value!;
            provider.conversation();
          }
        });
    }
  );
  // 将注册的命令和提供者添加到插件上下文的订阅中，以便在插件被禁用时取消注册：
  context.subscriptions.push(
    generationDispose,
    curosrDispose,
    conversationDispose
  );
}

class CursorWebviewViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  public message: string = "";
  public msgType: ResponseType = "freeform";
  public postContext: IChatList['context'] = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly extensionPath: string
  ) {
    // 获取配置项
    const config = vscode.workspace.getConfiguration('GGcopilot');
    // 获取配置项中的文本
    // const cursorToken: string = config.get('accessToken') as string;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    // 配置 webview
    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    // 设置 webview 的 HTML 内容
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    // 添加监听 webview层发送到 VSCode侧的事件
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "codeSelected": {
          // 如果没有活动的文本编辑器，则显示错误消息并退出
          if (!vscode.window.activeTextEditor) {
            vscode.window.showErrorMessage("no active text editor");
            break;
          }
          let code = data.value;
          // 将 $ 替换为 \$，以便在代码片段中使用 $ 符号
          code = code.replace(/([^\\])(\$)([^{0-9])/g, "$1\\$$$3");
          // insert the code as a snippet into the active text editor
          vscode.window.activeTextEditor?.insertSnippet(
            new vscode.SnippetString(code)
          );
          break;
        }
        case "prompt": {
          this.msgType = "freeform";
          this.message = data.value;
          this.conversation();
          break;
        }
        // 取消请求
        case "cancel": {
          source.cancel();
          break;
        }
        // 清除会话
        case "clear": {
          // 清除上下文
          this.postContext = [];
          break;
        }
      }
    });
  }


  // 发起对话请求
  public async conversation() {
    // 聚焦侧边栏
    if (!this._view) {
      await vscode.commands.executeCommand("GGcopilot.chatView.focus");
    } else {
      this._view.show?.(true);
    }
    // 提问题
    this._view?.webview.postMessage({
      type: "addQuestion",
      value: this.message,
      msgType: this.msgType,
      fileName: vscode.window.activeTextEditor?.document.fileName,
    });
    // 发起 API 请求：
    const params: IChatList = {
      email: 'weiyuhang@myhexin.com',
      content: this.message,
      context: this.postContext,
      showContent: true,
    };
    try {
      let response: RESPONSE = await getChatList(params);
      console.log(response.data);
      if (response) {
        // 保存上下文
        this.postContext = response.data.content;
        this._view?.webview.postMessage({
          type: "addAnswer",
          value: response.data.res,
        });
      }
    } catch (e: any) {
      // // 错误处理
      // if (e.response.status == 401) {
      //   this._view?.webview.postMessage({
      //     type: "showInput",
      //     value: "请先点击上方的登录按钮进行登录后使用",
      //   });
      //   return;
      // }
      // this._view?.webview.postMessage({
      //   type: "showInput",
      //   value: "出错啦，" + e.response.statusText,
      // });
      // return;
    }
  }

  // 生成用于 WebView 显示的 HTML 内容
  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "main.js")
    );
    const tailwindUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "media",
        "scripts",
        "tailwind.min.js"
      )
    );
    const markeddUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "media",
        "scripts",
        "marked.min.js"
      )
    );
    const highlightUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "media",
        "scripts",
        "highlight.min.js"
      )
    );
    const highlighDefualtUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "media",
        "css",
        "highligh.style.css"
      )
    );
    const leftSideStyleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "media",
        "css",
        "leftSideStyle.css"
      )
    );


    return `<!DOCTYPE html>
    <html lang="en">
    
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
      <script src="${tailwindUri}"></script>
      <script src="${highlightUri}"></script>
      <script src="${markeddUri}"></script>
      <link rel="stylesheet" href="${highlighDefualtUri}">
      <link rel="stylesheet" href="${leftSideStyleUri}">
    </head>
    
    <body>
      <div id="read-box">
        <p style="font-size: 1.6em">欢迎使用GGcopilot</p>
        <p>📃智能会话：可以在侧边栏直接与机器人对话，每次对话会携带之前的对话，也可以手动关闭对话，开启新的对话</p>
        <p>📝代码优化：在代码框中选中代码，点击右键，可以在菜单栏中选择预置prompt</p>
        <p>⌨️快速插入：在对话框中生成的代码，可直接点击快速插入到代码框对应的光标处</p>
        <p>⌨️快速插入：在对话框中生成的代码，可直接点击复制，即可把代码复制到剪切板</p>
        <p>🔑快捷键一：在代码框中按下Ctrl+Alt+Y弹出命令框，在输入框中输入问题，也可以选中代码后按快捷键，插件会将输入框内的内容和代码一起发送</p>
        <p>Tips：如果出现空白，没有回答内容的情况，请直接点击停止响应</p>
    
      </div>
    
      <div id="chat-box" class="pt-6 text-sm">请输入你的问题：</div>
      <div class="response-box"><button id="stop-response">停止响应</button></div>
      <div style="height: 80px;"></div>
    
      <div id="bottom-box">
        <button id="clear-msg">清除会话</button>
        <input class="h-10 w-full p-4 text-sm" type="text" id="prompt-input" placeholder="请输入你的问题..." />
      </div>
    </body>
    <script src="${scriptUri}"></script>
    
    </html>`;
  }
}

// This method is called when your extension is deactivated
export function deactivate() { }
