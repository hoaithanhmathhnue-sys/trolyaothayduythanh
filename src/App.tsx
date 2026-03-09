import { useState, useRef, useEffect, useCallback } from "react";
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Send, Bot, User, Sparkles, BookOpen, Square, Cylinder, Activity, Settings, X, ExternalLink, AlertTriangle, Paperclip, Mic, MicOff, FileText, Image as ImageIcon, Trash2, Upload, Volume2, Play, ChevronDown, ChevronUp, Lightbulb, PenLine } from "lucide-react";
import { cn } from "./lib/utils";

// --- ATTACHED FILE TYPE ---
type AttachedFile = {
  id: string;
  file: File;
  name: string;
  type: "image" | "document" | "audio";
  size: number;
  preview: string; // base64 data URL for images, or empty
  mimeType: string;
  base64Data: string; // raw base64 without prefix
};

const ACCEPTED_FILE_TYPES = [
  "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILES = 5;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getFileTypeCategory(mimeType: string): "image" | "document" | "audio" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

function getFileIcon(type: "image" | "document" | "audio") {
  switch (type) {
    case "image": return <ImageIcon className="w-4 h-4" />;
    case "audio": return <Volume2 className="w-4 h-4" />;
    default: return <FileText className="w-4 h-4" />;
  }
}

// --- SIMULATION LINKS ---
const SIMULATIONS = [
  {
    id: "nguyen-ham",
    title: "Mô phỏng Nguyên hàm",
    url: "https://cdn.gooo.ai/artifacts/019cd0d9-15bd-7755-9220-757d0c231f67/index.html",
    color: "from-emerald-500 to-teal-500",
    icon: <BookOpen className="w-4 h-4" />,
  },
  {
    id: "tich-phan",
    title: "Mô phỏng Tích phân xác định",
    url: "https://cdn.gooo.ai/artifacts/019cd0d9-314a-7560-85f2-234a9ae7b4c1/index.html",
    color: "from-blue-500 to-indigo-500",
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    id: "dien-tich",
    title: "Mô phỏng Diện tích hình phẳng",
    url: "https://cdn.gooo.ai/artifacts/019cd0d9-4b95-78eb-b880-f70f16d57b93/index.html",
    color: "from-violet-500 to-purple-500",
    icon: <Square className="w-4 h-4" />,
  },
  {
    id: "the-tich",
    title: "Mô phỏng Thể tích khối tròn xoay",
    url: "https://cdn.gooo.ai/artifacts/019cd0d9-69ab-772f-89a1-966e9a63bbb4/index.html",
    color: "from-orange-500 to-amber-500",
    icon: <Cylinder className="w-4 h-4" />,
  },
  {
    id: "chuyen-dong",
    title: "Mô phỏng Bài toán chuyển động",
    url: "https://cdn.gooo.ai/artifacts/019cd0d9-97a0-7bca-8370-75928f389904/index.html",
    color: "from-rose-500 to-pink-500",
    icon: <Activity className="w-4 h-4" />,
  },
];

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
  + KHÔNG được thêm các câu mở đầu hoặc kết thúc kiểu giới thiệu bối cảnh chương trình như: "Đây là nội dung trọng tâm của chương IV", "sách giáo khoa Chân Trời Sáng Tạo", "thuộc chương Nguyên hàm – Tích phân"... Hãy đi thẳng vào nội dung bài toán, không cần nhắc lại tên SGK hay chương trình.

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

Thầy có thể:
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

Thầy có thể:
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

Thầy có thể:
1. Nhắc lại công thức thể tích vật thể tròn xoay quanh Ox.
2. Chỉ rõ vì sao phải dùng [f(x)]^2 trong tích phân.
3. Gợi ý em tự viết công thức V = π ∫_a^b [f(x)]^2 dx trước, rồi thầy mới kiểm tra.
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

  // File attachment state
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Drag & drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

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

  // --- FILE HANDLING ---
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get raw base64
        const base64 = result.split(",")[1] || "";
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: AttachedFile[] = [];

    for (const file of fileArray) {
      // Check max files
      if (attachedFiles.length + validFiles.length >= MAX_FILES) {
        alert(`Chỉ được đính kèm tối đa ${MAX_FILES} file.`);
        break;
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        alert(`File "${file.name}" quá lớn. Giới hạn ${formatFileSize(MAX_FILE_SIZE)}.`);
        continue;
      }

      // Check file type
      if (!ACCEPTED_FILE_TYPES.includes(file.type) && !file.type.startsWith("audio/")) {
        alert(`Định dạng file "${file.name}" không được hỗ trợ.\nChỉ chấp nhận: Word, PDF, hình ảnh.`);
        continue;
      }

      try {
        const base64Data = await readFileAsBase64(file);
        const category = getFileTypeCategory(file.type);
        const preview = category === "image" ? URL.createObjectURL(file) : "";

        validFiles.push({
          id: Date.now().toString() + Math.random().toString(36).substring(2),
          file,
          name: file.name,
          type: category,
          size: file.size,
          preview,
          mimeType: file.type,
          base64Data,
        });
      } catch (err) {
        console.error("Error reading file:", err);
      }
    }

    if (validFiles.length > 0) {
      setAttachedFiles(prev => [...prev, ...validFiles]);
    }
  }, [attachedFiles.length]);

  const removeFile = useCallback((id: string) => {
    setAttachedFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter(f => f.id !== id);
    });
  }, []);

  // --- VOICE RECORDING ---
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], `ghi-am-${Date.now()}.webm`, { type: "audio/webm" });

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Add to attached files
        const base64Data = await readFileAsBase64(audioFile);
        setAttachedFiles(prev => [...prev, {
          id: Date.now().toString() + Math.random().toString(36).substring(2),
          file: audioFile,
          name: audioFile.name,
          type: "audio",
          size: audioFile.size,
          preview: "",
          mimeType: "audio/webm",
          base64Data,
        }]);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error starting recording:", err);
      alert("Không thể truy cập microphone. Vui lòng cấp quyền truy cập.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // --- DRAG & DROP HANDLERS ---
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleSend = async (text: string = input) => {
    if ((!text.trim() && attachedFiles.length === 0) || isLoading) return;

    if (!apiKey) {
      setShowApiKeyModal(true);
      return;
    }

    // Build display content for user message
    const modeLabel = answerMode === "hint" ? "💡 Gợi ý nhẹ" : "📝 Giải chi tiết";
    const fileNames = attachedFiles.map(f => `📎 ${f.name}`).join("\n");
    const displayContent = [`[${modeLabel}]`, text.trim(), fileNames].filter(Boolean).join("\n\n");

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: displayContent
    };

    // Capture current files before clearing
    const filesToSend = [...attachedFiles];

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setAttachedFiles([]);
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

        // Build message parts with files
        let messageParts: any;
        if (filesToSend.length > 0) {
          const parts: any[] = [];
          // Add file parts
          for (const f of filesToSend) {
            parts.push({
              inlineData: {
                mimeType: f.mimeType,
                data: f.base64Data,
              }
            });
          }
          // Add text part
          if (text.trim()) {
            parts.push({ text: text.trim() });
          } else {
            parts.push({ text: "Hãy phân tích nội dung file/hình ảnh mà em đã gửi." });
          }
          messageParts = parts;
        } else {
          messageParts = text;
        }

        // Prepend answer mode instruction
        const modeInstruction = answerMode === "hint"
          ? "[CHẾ ĐỘ GỢI Ý NHẸ] Hãy chỉ đưa ra các gợi ý, hướng dẫn cách giải từng bước, nhắc công thức liên quan, NHƯNG KHÔNG cho đáp án cuối cùng. Để học sinh tự làm."
          : "[CHẾ ĐỘ GIẢI CHI TIẾ T] Hãy giải bài toán này chi tiết từng bước, trình bày rõ ràng, có công thức và đáp án cuối cùng.";

        if (Array.isArray(messageParts)) {
          // Find the text part and prepend mode instruction
          const textPartIndex = messageParts.findIndex((p: any) => p.text);
          if (textPartIndex !== -1) {
            messageParts[textPartIndex].text = modeInstruction + "\n\n" + messageParts[textPartIndex].text;
          }
        } else {
          messageParts = modeInstruction + "\n\n" + messageParts;
        }

        const stream = await session.sendMessageStream({ message: messageParts });

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

  const hasContent = input.trim().length > 0 || attachedFiles.length > 0;

  // Answer mode: "hint" = Gợi ý nhẹ, "detailed" = Giải chi tiết
  type AnswerMode = "hint" | "detailed";
  const [answerMode, setAnswerMode] = useState<AnswerMode>("hint");

  // Simulation panel state
  const [showSimulations, setShowSimulations] = useState(false);

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
              <p className="text-blue-100 text-sm">Trường THPT Tân Phước Khánh</p>
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

      {/* Simulation Panel */}
      <div className="bg-white border-b border-slate-200 shrink-0">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setShowSimulations(!showSimulations)}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-1.5 rounded-lg">
                <Play className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-slate-700">Mô phỏng tương tác</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{SIMULATIONS.length} bài</span>
            </div>
            {showSimulations ? (
              <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
            )}
          </button>

          {showSimulations && (
            <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {SIMULATIONS.map((sim) => (
                <a
                  key={sim.id}
                  href={sim.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-transparent hover:shadow-lg transition-all group/card bg-white hover:bg-gradient-to-r hover:from-slate-50 hover:to-white"
                >
                  <div className={cn(
                    "p-2 rounded-lg bg-gradient-to-r text-white shrink-0 shadow-sm group-hover/card:shadow-md transition-shadow",
                    sim.color
                  )}>
                    {sim.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-700 truncate">{sim.title}</p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <ExternalLink className="w-3 h-3" />
                      Mở mô phỏng
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
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
        <div className="max-w-3xl mx-auto space-y-3">
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

          {/* Answer Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium shrink-0">Chế độ:</span>
            <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setAnswerMode("hint")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  answerMode === "hint"
                    ? "bg-amber-500 text-white shadow-md shadow-amber-200"
                    : "text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                )}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                Gợi ý nhẹ
              </button>
              <button
                onClick={() => setAnswerMode("detailed")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  answerMode === "detailed"
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                    : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                )}
              >
                <PenLine className="w-3.5 h-3.5" />
                Giải chi tiết
              </button>
            </div>
          </div>

          {/* Attached Files Preview */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
              {attachedFiles.map((file) => (
                <div
                  key={file.id}
                  className="group relative flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm hover:shadow-md transition-all max-w-[200px]"
                >
                  {/* Thumbnail or icon */}
                  {file.type === "image" && file.preview ? (
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                      file.type === "audio" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                    )}>
                      {getFileIcon(file.type)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-700 truncate">{file.name}</p>
                    <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
                  </div>
                  {/* Remove button */}
                  <button
                    onClick={() => removeFile(file.id)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Chat Input with Drag & Drop */}
          <div
            className={cn(
              "relative rounded-2xl border-2 transition-all",
              isDragOver
                ? "border-blue-400 bg-blue-50 ring-2 ring-blue-200"
                : "border-slate-200 bg-slate-50 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400"
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Drag overlay */}
            {isDragOver && (
              <div className="absolute inset-0 bg-blue-50/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-10 pointer-events-none">
                <div className="bg-blue-100 p-3 rounded-full mb-2 animate-bounce">
                  <Upload className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-blue-600 font-semibold text-sm">Thả file vào đây</p>
                <p className="text-blue-400 text-xs mt-1">Word, PDF, hình ảnh</p>
              </div>
            )}

            {/* Recording indicator */}
            {isRecording && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-100 rounded-t-2xl">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-600 text-sm font-medium">Đang ghi âm</span>
                <span className="text-red-500 text-sm font-mono">{formatRecordingTime(recordingTime)}</span>
                <button
                  onClick={stopRecording}
                  className="ml-auto text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full transition-colors font-medium"
                >
                  Dừng ghi âm
                </button>
              </div>
            )}

            <div className="flex items-end gap-2 p-2">
              {/* Textarea */}
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
                placeholder={isDragOver ? "Thả file vào đây..." : "Nhập bài toán hoặc câu hỏi, hoặc kéo thả file vào đây..."}
                className="flex-1 max-h-40 min-h-[44px] bg-transparent resize-none outline-none py-2 px-3 text-slate-700 placeholder:text-slate-400"
                rows={input.split("\n").length > 1 ? Math.min(input.split("\n").length, 5) : 1}
              />

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0 mb-0.5">
                {/* Upload file button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".doc,.docx,.pdf,.png,.jpg,.jpeg,.gif,.webp,image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleFileSelect(e.target.files);
                    e.target.value = ""; // reset để cho phép chọn lại cùng file
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                  title="Đính kèm file (Word, PDF, hình ảnh)"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                {/* Voice recording button */}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={cn(
                    "p-2.5 rounded-xl transition-all",
                    isRecording
                      ? "text-white bg-red-500 hover:bg-red-600 animate-pulse"
                      : "text-slate-400 hover:text-purple-600 hover:bg-purple-50"
                  )}
                  title={isRecording ? "Dừng ghi âm" : "Ghi âm giọng nói"}
                >
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {/* Send button */}
                <button
                  onClick={() => handleSend()}
                  disabled={!hasContent || isLoading}
                  className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Helper text */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>📎 Word, PDF, hình ảnh · 🎤 Ghi âm · Kéo thả file vào ô nhập</span>
            <span>Trợ lý ảo chỉ hỗ trợ học tập</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
