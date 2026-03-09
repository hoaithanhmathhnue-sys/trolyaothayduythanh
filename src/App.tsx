import { useState, useRef, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Send, Bot, User, Sparkles, BookOpen, Square, Cylinder, Activity, Settings, X, ExternalLink, AlertTriangle } from "lucide-react";
import { cn } from "./lib/utils";

// --- MODEL CONFIGURATION (LỆNH.md §1) ---
const AI_MODELS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Nhanh, ổn định", badge: "" },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", description: "Mới nhất, thông minh", badge: "Mặc định" },
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", description: "Mạnh nhất, chính xác", badge: "Pro" },
];

// Fallback model order for auto-retry
const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
];

// --- SYSTEM INSTRUCTION ---
const SYSTEM_INSTRUCTION = `Bạn là "Trợ lý ảo của thầy Nguyễn Duy Thanh" – chuyên hỗ trợ Nguyên hàm & Tích phân, trường THPT Tân Phước Khánh.

1. Bối cảnh & chương trình:
- Môn: Toán 12 THPT, bộ sách: Chân Trời Sáng Tạo.
- Nội dung trọng tâm: Chương IV – Nguyên hàm, Tích phân và Ứng dụng (Toán 12 – Tập 2).
- Đối tượng: Học sinh khối 12, trình độ từ trung bình đến khá giỏi, đang chuẩn bị cho kỳ thi TN THPT.

2. Vai trò sư phạm:
- Bạn đóng vai trợ lý ảo của thầy Nguyễn Duy Thanh, giáo viên Toán trường THPT Tân Phước Khánh.
- Phong cách: kiên nhẫn, tôn trọng, khích lệ, dùng ngôn ngữ gần gũi nhưng chính xác.
- Mục tiêu: phát triển năng lực TỰ HỌC, TƯ DUY LOGIC, NĂNG LỰC SỐ cho học sinh; KHÔNG phải chỉ cho đáp án.

3. Nguyên tắc trả lời:
- LUÔN LUÔN:
  + Hỏi lại tối thiểu 1–2 câu để hiểu học sinh đang vướng ở đâu (hiểu đề, lập cận, chọn phương pháp,…).
  + Gợi ý theo BƯỚC, từ dễ đến khó; chỉ cho lời giải chi tiết nếu:
    * Học sinh đã thử mà sai hoặc bí thật sự, HOẶC
    * Học sinh yêu cầu rõ ràng: "Cho em lời giải chi tiết cuối cùng".
  + Khi cho lời giải, phải:
    * Viết rõ từng bước, nêu lý do chọn phương pháp (đổi biến, từng phần, xét dấu, tách tích phân…).
    * Nhắc lại công thức, định nghĩa quan trọng trích từ mạch kiến thức SGK Chân Trời Sáng Tạo.

- TUYỆT ĐỐI KHÔNG:
  + Trả lời kiểu "đáp án cuối" duy nhất, thiếu lời giải.
  + Sử dụng kỹ thuật hoặc kiến thức vượt xa chương trình Toán 12 Việt Nam nếu không thật sự cần thiết.
  + Bỏ qua yêu cầu, hoặc trả lời quá ngắn khiến HS không hiểu vì sao làm như vậy.

4. Quy trình hỗ trợ chuẩn 4 bước:
Trong mỗi bài toán, cố gắng bám quy trình sau (có thể rút gọn nếu bài rất đơn giản):

  (1) Hiểu đề và nhận diện dạng toán:
      - Yêu cầu học sinh:
        * Viết lại đề.
        * Nêu xem đây là dạng: tính nguyên hàm, tích phân xác định, diện tích hình phẳng, thể tích tròn xoay, ứng dụng vật lý (vận tốc–quãng đường),…
      - Nếu HS không nhận diện được, bạn phải gợi ý.

  (2) Nhắc công thức / định lý liên quan:
      - Nhắc lại các công thức cơ bản:
        * Bảng nguyên hàm cơ bản.
        * Quy tắc tính tích phân (tách, đổi biến, từng phần).
        * Diện tích hình phẳng: S = ∫_a^b |f(x)| dx.
        * Thể tích tròn xoay: V = π ∫_a^b [f(x)]^2 dx.
        * Liên hệ đạo hàm – nguyên hàm trong bài toán chuyển động: v'(t) = a(t), s'(t) = v(t),…
      - Viết công thức rõ ràng, có LaTeX nếu nền tảng hỗ trợ.

  (3) Gợi mở từng bước:
      - Đưa câu hỏi nhỏ:
        * "Em thử tìm nghiệm/điểm cắt trước xem?"
        * "Em chọn đặt u là gì? Vì sao?"
        * "Trong đoạn [a; b], f(x) dương hay âm?"
      - Cho ví dụ đơn giản tương tự nếu HS quá yếu.

  (4) Kiểm tra hiểu và củng cố:
      - Khi làm xong, yêu cầu HS:
        * Giải thích lại một bước quan trọng (ví dụ: tại sao chọn u = ln x,…).
        * Làm thêm một bài tương tự (tự đề xuất hoặc bạn gợi ý).

5. Hạn chế – cảnh báo đạo đức học tập:
- Khi học sinh gửi ảnh bài kiểm tra hoặc đề thi thật, hãy nhắc:
  + "Trợ lý ảo chỉ hỗ trợ học, KHÔNG làm hộ bài kiểm tra/thi."
- Khuyến khích các em tự trình bày:
  + "Em hãy chép lại đề và cho biết em đã làm đến bước nào" trước khi bắt đầu hỗ trợ.

6. Yêu cầu về trình bày:
- Luôn trả lời bằng tiếng Việt, có thể dùng LaTeX cho công thức.
- Với bài dài, nên chia thành: "Bước 1", "Bước 2", "Nhận xét".
- Nếu HS hỏi lý thuyết, hãy giải thích ngắn gọn, có ví dụ số cụ thể.

7. Giới hạn phạm vi:
- Ưu tiên TRIỆT ĐỂ chương:
  + Nguyên hàm – tích phân không xác định.
  + Tích phân xác định.
  + Diện tích hình phẳng.
  + Thể tích vật thể tròn xoay.
  + Ứng dụng trong chuyển động, dung tích bồn chứa, bài toán hình học phẳng gắn với tích phân.
- Nếu HS hỏi ngoài phạm vi (hình không gian phức tạp, bài đại số nâng cao), hãy:
  + Trả lời ở mức định hướng cơ bản.
  + Gợi ý quay lại trọng tâm chương Nguyên hàm – Tích phân nếu đang ôn thi gấp.

8. Phản hồi theo phong cách thầy Nguyễn Duy Thanh:
- Thi thoảng có thể dùng những câu khích lệ gần gũi:
  + "Cách làm của em giống hệt cách thầy Thanh hướng dẫn trên lớp rồi đó."
  + "Em đang đi đúng hướng, chỉ sai ở bước xét dấu thôi, mình sửa lại nhé."
- Tôn trọng mọi câu hỏi kể cả "ngô nghê", không chê bai.`;

// --- QUICK PROMPTS ---
const QUICK_PROMPTS = [
  {
    id: "nguyen-ham",
    title: "Nguyên hàm",
    icon: <BookOpen className="w-4 h-4" />,
    text: `Em đang ôn phần Nguyên hàm – Tích phân không xác định trong Chương IV Toán 12 (Chân Trời Sáng Tạo).

Bài cần làm:
Tìm nguyên hàm của: [ghi hàm f(x) vào đây].

Anh/chị hãy:
1. Chỉ cho em cách nhận biết dạng hàm này thuộc loại nào (dùng bảng nguyên hàm cơ bản, đổi biến, từng phần,…).
2. Nhắc lại rõ công thức hoặc quy tắc tương ứng.
3. Gợi ý bước đầu (chẳng hạn gợi ý chọn u, dv nếu từng phần; gợi ý đặt t = … nếu đổi biến).
4. Chờ em trả lời rồi mới tiếp tục, đừng cho đáp án cuối ngay.`
  },
  {
    id: "dien-tich",
    title: "Diện tích",
    icon: <Square className="w-4 h-4" />,
    text: `Em đang học phần diện tích hình phẳng (Ứng dụng tích phân).

Đề bài:
Tính diện tích hình phẳng giới hạn bởi: [ghi rõ các hàm số vào đây, ví dụ: y = x^2 - 4x + 3 và trục hoành].

Anh/chị hãy:
1. Hướng dẫn em tìm giao điểm (các cận tích phân).
2. Giải thích cách xác định hàm nằm trên, hàm nằm dưới trên đoạn đó.
3. Nhắc lại công thức diện tích bằng tích phân (nói luôn về việc xét dấu hoặc dùng giá trị tuyệt đối).
4. Cho em gợi ý thiết lập biểu thức tích phân trước, sau đó mới tính cụ thể nếu em yêu cầu.`
  },
  {
    id: "the-tich",
    title: "Thể tích",
    icon: <Cylinder className="w-4 h-4" />,
    text: `Em đang học phần thể tích vật thể tròn xoay.

Đề bài:
Cho đường cong: y = [ghi f(x) vào đây], quay quanh trục Ox, từ x = a đến x = b. Hãy tính thể tích.

Anh/chị hãy:
1. Nhắc lại công thức thể tích vật thể tròn xoay quanh Ox.
2. Chỉ rõ vì sao phải dùng [f(x)]^2 trong tích phân.
3. Gợi ý em tự viết công thức V = π ∫_a^b [f(x)]^2 dx trước, rồi anh/chị mới kiểm tra.
4. Nếu em sai, hãy chỉ ra sai chỗ nào (quên bình phương, sai cận, sai đơn vị,…).`
  },
  {
    id: "chuyen-dong",
    title: "Chuyển động",
    icon: <Activity className="w-4 h-4" />,
    text: `Em đang học phần ứng dụng nguyên hàm trong bài toán chuyển động.

Đề bài:
[ghi rõ a(t), v(t0), s(t0) hoặc yêu cầu v(t), s(t)... vào đây]

Anh/chị hãy:
1. Nhắc lại mối quan hệ giữa a(t), v(t), s(t) (v'(t) = a(t), s'(t) = v(t)).
2. Hướng dẫn em thiết lập nguyên hàm đúng để tìm v(t) hoặc s(t).
3. Nhắc em đừng quên hằng số C và cách tìm C từ điều kiện ban đầu.
4. Cho em tự tính ra biểu thức rồi anh/chị kiểm tra từng bước.`
  }
];

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

// --- API KEY MODAL COMPONENT ---
function ApiKeyModal({
  isOpen,
  onClose,
  onSave,
  currentKey,
  canClose
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
  currentKey: string;
  canClose: boolean;
}) {
  const [keyInput, setKeyInput] = useState(currentKey);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Thiết lập API Key</h2>
                <p className="text-blue-100 text-sm">Nhập Gemini API Key để sử dụng app</p>
              </div>
            </div>
            {canClose && (
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Gemini API Key
            </label>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700 font-mono text-sm"
              autoFocus
            />
          </div>

          <a
            href="https://aistudio.google.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Lấy API Key tại Google AI Studio
          </a>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">
                API Key được lưu trên trình duyệt của em. Nếu hết quota, hãy dùng API key của Gmail khác hoặc chờ đến hôm sau.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (keyInput.trim()) {
                onSave(keyInput.trim());
              }
            }}
            disabled={!keyInput.trim()}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
          >
            Lưu và bắt đầu
          </button>
        </div>
      </div>
    </div>
  );
}

// --- MODEL SELECTOR COMPONENT ---
function ModelSelector({
  selectedModel,
  onSelectModel,
}: {
  selectedModel: string;
  onSelectModel: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {AI_MODELS.map((model) => (
        <button
          key={model.id}
          onClick={() => onSelectModel(model.id)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border",
            selectedModel === model.id
              ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200"
              : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
          )}
        >
          <span>{model.name}</span>
          {model.badge && (
            <span className={cn(
              "px-1.5 py-0.5 rounded-md text-[10px] font-bold",
              selectedModel === model.id
                ? "bg-white/20 text-white"
                : "bg-blue-100 text-blue-600"
            )}>
              {model.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  // API Key state
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem("gemini_api_key") || "";
  });
  const [showApiKeyModal, setShowApiKeyModal] = useState(!apiKey);

  // Model selection
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem("selected_model") || "gemini-3-flash-preview";
  });

  // Chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Chào em! Thầy là Trợ lý ảo của thầy Nguyễn Duy Thanh - Trường THPT Tân Phước Khánh đây.\nHôm nay em muốn ôn tập phần nào trong chương Nguyên hàm - Tích phân?\nEm có thể gõ câu hỏi hoặc chọn một trong các mẫu bên dưới nhé!"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<any>(null);
  const currentModelRef = useRef<string>(selectedModel);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Save API key to localStorage
  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem("gemini_api_key", key);
    setShowApiKeyModal(false);
    // Reset chat session so it uses the new key
    chatSessionRef.current = null;
  };

  // Save selected model
  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem("selected_model", modelId);
    currentModelRef.current = modelId;
    // Reset chat session to use new model
    chatSessionRef.current = null;
  };

  // Initialize or get chat session
  const getChatSession = (modelId?: string) => {
    const useModel = modelId || currentModelRef.current;
    try {
      if (!apiKey) {
        setShowApiKeyModal(true);
        return null;
      }
      const ai = new GoogleGenAI({ apiKey });
      const session = ai.chats.create({
        model: useModel,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.4,
        }
      });
      return session;
    } catch (error) {
      console.error("Failed to initialize chat:", error);
      return null;
    }
  };

  // Initialize session when apiKey or model changes
  useEffect(() => {
    if (apiKey) {
      chatSessionRef.current = getChatSession();
    }
  }, [apiKey, selectedModel]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    if (!apiKey) {
      setShowApiKeyModal(true);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Auto-retry with fallback models (LỆNH.md §1)
    const modelsToTry = [currentModelRef.current, ...FALLBACK_MODELS.filter(m => m !== currentModelRef.current)];
    let success = false;

    for (const modelId of modelsToTry) {
      try {
        // Get or create session for this model
        let session = modelId === currentModelRef.current ? chatSessionRef.current : null;
        if (!session) {
          session = getChatSession(modelId);
          if (!session) continue;
          if (modelId === currentModelRef.current) {
            chatSessionRef.current = session;
          }
        }

        // Add a temporary assistant message for streaming
        const assistantMessageId = (Date.now() + 1).toString();
        setMessages(prev => [
          ...prev,
          { id: assistantMessageId, role: "assistant", content: "" }
        ]);

        const stream = await session.sendMessageStream({ message: text });

        let fullResponse = "";
        for await (const chunk of stream) {
          const c = chunk as any;
          if (c.text) {
            fullResponse += c.text;
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: fullResponse }
                  : msg
              )
            );
          }
        }

        success = true;
        break; // Success, no need to retry
      } catch (error: any) {
        console.error(`Error with model ${modelId}:`, error);

        // Remove the empty assistant message if it was added
        setMessages(prev => prev.filter(msg => msg.content !== "" || msg.role !== "assistant"));

        // If it's a quota error, show specific message
        if (error?.message?.includes("quota") || error?.status === 429) {
          // Don't try next model for quota errors on all models - let it fall through
          continue;
        }

        // Reset session for current model so it creates a new one
        if (modelId === currentModelRef.current) {
          chatSessionRef.current = null;
        }

        continue; // Try next model
      }
    }

    if (!success) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "⚠️ Xin lỗi em, tất cả các model AI đều đang gặp sự cố hoặc API Key đã hết quota.\n\n**Cách khắc phục:**\n1. Lấy API key từ Gmail khác tại [Google AI Studio](https://aistudio.google.com/api-keys)\n2. Bấm nút ⚙️ **Settings** trên thanh tiêu đề để nhập key mới\n3. Hoặc chờ đến ngày mai để dùng tiếp key hiện tại"
        }
      ]);
    }

    setIsLoading(false);
  };

  const handleQuickPrompt = (text: string) => {
    setInput(text);
    const textarea = document.getElementById("chat-input");
    if (textarea) {
      textarea.focus();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSave={handleSaveApiKey}
        currentKey={apiKey}
        canClose={!!apiKey}
      />

      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 shadow-lg shrink-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2.5 rounded-full">
              <Sparkles className="w-6 h-6 text-blue-50" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Trợ lý ảo thầy Nguyễn Duy Thanh</h1>
              <p className="text-blue-100 text-sm">Trường THPT Tân Phước Khánh - Nguyên hàm & Tích phân</p>
            </div>
          </div>

          {/* Settings button (LỆNH.md §2) */}
          <button
            onClick={() => setShowApiKeyModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
            title="Thiết lập API Key"
          >
            <Settings className="w-5 h-5" />
            <span className="text-red-300 text-xs font-medium hidden sm:inline">
              {apiKey ? "Đổi API Key" : "Lấy API key để sử dụng app"}
            </span>
          </button>
        </div>
      </header>

      {/* Model Selector Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium shrink-0">Model AI:</span>
            <ModelSelector selectedModel={selectedModel} onSelectModel={handleSelectModel} />
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-4 max-w-[85%]",
                msg.role === "user" ? "ml-auto flex-row-reverse" : ""
              )}
            >
              {/* Avatar */}
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                msg.role === "user" ? "bg-blue-100 text-blue-600" : "bg-blue-600 text-white"
              )}>
                {msg.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>

              {/* Message Bubble */}
              <div className={cn(
                "p-4 rounded-2xl shadow-sm overflow-hidden",
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-tr-none"
                  : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
              )}>
                <div className={cn(
                  "prose prose-sm sm:prose-base max-w-none",
                  msg.role === "user" ? "prose-invert" : "prose-slate",
                  "[&_.math-display]:overflow-x-auto [&_.math-display]:py-2"
                )}>
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-5 h-5" />
              </div>
              <div className="p-4 rounded-2xl rounded-tl-none bg-white border border-slate-200 shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t border-slate-200 p-4 shrink-0">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Quick Prompts */}
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt.id}
                onClick={() => handleQuickPrompt(prompt.text)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-sm rounded-full transition-colors border border-slate-200 hover:border-blue-200"
              >
                {prompt.icon}
                <span>{prompt.title}</span>
              </button>
            ))}
          </div>

          {/* Chat Input */}
          <div className="relative flex items-end gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-all">
            <textarea
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Nhập bài toán hoặc câu hỏi của em vào đây..."
              className="flex-1 max-h-40 min-h-[44px] bg-transparent resize-none outline-none py-2 px-3 text-slate-700 placeholder:text-slate-400"
              rows={input.split("\n").length > 1 ? Math.min(input.split("\n").length, 5) : 1}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors shrink-0 mb-0.5"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center text-xs text-slate-400">
            Trợ lý ảo chỉ hỗ trợ học tập, không giải hộ bài kiểm tra. Hãy tự mình suy nghĩ nhé!
          </div>
        </div>
      </footer>
    </div>
  );
}
