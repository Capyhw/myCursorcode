/* eslint-disable @typescript-eslint/naming-convention */
import axios, { CancelTokenSource } from "axios";
//接口基本信息
const url = 'https://frontend.myhexin.com/kingfisher/robot/homeworkChat';
const token = '610EE45BF-Qtc2VydmU=';
// 定义接口参数类型
interface IChatList {
  content: string;
  email: string;
  temperature?: number;
  context?: { role: 'user' | 'assistant', content: string }[];
  showContent?: boolean;
}
// 给接口返回值定义类型
interface RESPONSE {
  'status_code': number;
  'status_msg': string;
  //data的类型为对象，对象里有res是string,content是和IChatList中的content一样的类型
  data: {
    res: string;
    content: IChatList['context'];
  };
}
//取消请求
let source: CancelTokenSource;
//获取聊天列表
export async function getChatList({ email, temperature = 1, content, context, showContent = false }: IChatList): Promise<RESPONSE> {
  source = axios.CancelToken.source();
  const res = await axios.post(url, {
    content,
    source: `homework-47-{${email}}`,
    token,
    temperature,
    context,
    showContent
  },
    {
      headers: { 'Content-Type': 'application/json' },
      cancelToken: source.token
    }).catch((err) => {
      if (axios.isCancel(err)) {
        console.log('Request canceled', err.message);
      } else {
        // 处理错误
        console.log(err);
      }
    });
  //错误处理
  if (res?.data.status_code !== 0) {
    throw new Error(res?.data.status_msg);
  }
  return res.data;
}

export { IChatList, RESPONSE, source };



