import {
  ArrowLeft,
  AudioLines,
  ArrowUp,
  ChevronDown,
  Mic,
  MessagesSquare,
  X,
} from "lucide-react";
import type { Product } from "./api";

interface VoicePracticePreviewProps {
  product: Product;
  practiceType: string;
  backTo: string;
  coachOpen: boolean;
}

/** 展示语音练习待接入界面，提供资料与教练面板入口，并明确通话尚不可用。 */
export function VoicePracticePreview({
  product,
  practiceType,
  backTo,
  coachOpen,
}: VoicePracticePreviewProps) {
  return (
    <div className="voice-preview">
      <header className="voice-toolbar">
        <div className="voice-session-title">
          <button
            className="icon-button"
            data-action="nav"
            data-id={backTo}
            aria-label="返回语音产品选择"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2>{product.name}</h2>
            <p className="small muted">{practiceType}</p>
          </div>
        </div>
        <div className="actions">
          <button
            className="button"
            data-action="nav"
            data-id={"product/" + product.id}
          >
            产品资料
          </button>
          <button
            className={"button " + (coachOpen ? "primary" : "")}
            data-action="coach"
            aria-expanded={coachOpen}
            aria-controls="voice-coach"
          >
            问教练
          </button>
        </div>
      </header>
      <div className={"voice-layout " + (coachOpen ? "with-coach" : "")}>
        <section className="voice-customer" aria-label="语音客户">
          <div className="voice-call-stage">
            <div className="voice-customer-symbol" aria-hidden="true">
              <AudioLines size={64} strokeWidth={1.5} />
            </div>
            <h1>模拟客户</h1>
            <p
              className="voice-service-status"
              id="voice-service-status"
              role="status"
            >
              语音模型待接入
            </p>
            <button
              className="button primary voice-start"
              disabled
              aria-describedby="voice-service-status"
            >
              <Mic size={20} /> 开始语音
            </button>
          </div>
          <details className="voice-transcript" open>
            <summary>
              <MessagesSquare size={17} aria-hidden="true" /> 对话记录
              <ChevronDown
                className="voice-transcript-chevron"
                size={17}
                aria-hidden="true"
              />
            </summary>
            <div className="voice-transcript-empty">暂无对话</div>
          </details>
        </section>
        {coachOpen && (
          <aside
            className="voice-coach"
            id="voice-coach"
            aria-label="语音训练教练"
          >
            <header className="coach-heading">
              <h3>训练教练</h3>
              <button
                className="icon-button"
                data-action="coach"
                aria-label="收起语音教练"
              >
                <X size={18} />
              </button>
            </header>
            <div className="voice-coach-empty">
              <MessagesSquare size={28} strokeWidth={1.5} aria-hidden="true" />
              <p>语音对话开始后可提问</p>
            </div>
            <div className="composer">
              <textarea
                aria-label="向语音教练提问"
                placeholder="向教练提问…"
                disabled
              />
              <div className="voice-coach-send">
                <button className="button primary" disabled>
                  发送 <ArrowUp size={16} />
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
