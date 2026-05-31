export interface ModalController {
  show(onContinue: () => void, onStop: () => void, timeoutSeconds: number): void;
  close(): void;
  dispose(): void;
}

type ModalControllerProps = {
  message?: string | null | undefined;
  continueButtonText?: string | null | undefined;
  stopButtonText?: string | null | undefined;
};

export function createModalController(props: ModalControllerProps): ModalController {
  const {
    message = "Are you still watching?",
    continueButtonText = "Yes, I'm still watching",
    stopButtonText = "Stop watching",
  } = props;
  let root: HTMLDivElement | null = null;
  let intervalId: number | null = null;
  let keyHandler: ((event: KeyboardEvent) => void) | null = null;
  let closed = true;

  const ensureRoot = (): HTMLDivElement => {
    if (root) return root;

    root = document.createElement("div");
    root.className = "jellycheckr-modal-backdrop";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");

    root.innerHTML = `
      <div class="jellycheckr-modal">
        <p class="jellycheckr-question">${message}</p>
        <button class="jellycheckr-continue">${continueButtonText}</button>
        <p class="jellycheckr-countdown"></p>
        <button class="jellycheckr-stop">${stopButtonText}</button>
      </div>
    `;

    document.body.appendChild(root);
    injectStyles();

    return root;
  };

  const show = (
    onContinue: () => void,
    onStop: () => void,
    timeoutSeconds: number
  ): void => {
    const node = ensureRoot();
    closed = false;

    node.style.display = "flex";

    const continueButton = node.querySelector<HTMLButtonElement>(".jellycheckr-continue");
    const stopButton = node.querySelector<HTMLButtonElement>(".jellycheckr-stop");
    const countdownNode = node.querySelector<HTMLParagraphElement>(".jellycheckr-countdown");

    if (!continueButton || !stopButton || !countdownNode) return;

    let secondsLeft = timeoutSeconds;

    const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const renderCountdown = () => {
      const seconds = Math.max(secondsLeft, 0);
      countdownNode.innerHTML = `Stopping in <strong>${formatTime(seconds)}</strong>`;
    };

    renderCountdown();

    continueButton.focus();

    continueButton.onclick = () => {
      if (closed) return;
      onContinue();
    };

    stopButton.onclick = () => {
      if (closed) return;
      onStop();
    };

    keyHandler = (event: KeyboardEvent): void => {
      if (event.key === "Tab") {
        event.preventDefault();
        if (document.activeElement === continueButton) stopButton.focus();
        else continueButton.focus();
      }

      if (event.key === "ArrowRight") stopButton.focus();
      if (event.key === "ArrowLeft") continueButton.focus();
      if (event.key === "Escape" && !closed) onStop();
      if (
        event.key === "Enter" &&
        document.activeElement === stopButton &&
        !closed
      )
        onStop();

      if (
        event.key === "Enter" &&
        document.activeElement === continueButton &&
        !closed
      )
        onContinue();
    };

    window.addEventListener("keydown", keyHandler);

    if (intervalId !== null) window.clearInterval(intervalId);

    intervalId = window.setInterval(() => {
      secondsLeft -= 1;
      renderCountdown();

      if (secondsLeft <= 0 && !closed) {
        window.clearInterval(intervalId!);
        intervalId = null;
        onStop();
      }
    }, 1000);
  };

  const close = (): void => {
    closed = true;

    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }

    if (root) root.style.display = "none";

    if (keyHandler) {
      window.removeEventListener("keydown", keyHandler);
      keyHandler = null;
    }
  };

  const dispose = (): void => {
    close();
    root?.remove();
    root = null;
  };

  return { show, close, dispose };
}

function injectStyles(): void {
  if (document.getElementById("jellycheckr-modal-style")) return;

  const style = document.createElement("style");
  style.id = "jellycheckr-modal-style";
  style.textContent = `
    .jellycheckr-modal-backdrop {
      position: fixed;
      inset: 0;
      display: none;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(3px);
      z-index: 99999;
      animation: jellyFadeIn 200ms ease-out;
    }

    .jellycheckr-modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.96);
      width: min(360px, 88vw);
      background: rgba(18, 18, 18, 0.96);
      color: #fff;
      border-radius: 12px;
      padding: 32px 28px 24px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      z-index: 100000;
      animation: jellyModalIn 200ms ease-out forwards;
    }

    .jellycheckr-question {
      font-size: 1.4rem;
      font-weight: 600;
      margin: 0 0 22px 0;
      line-height: 1.3;
      letter-spacing: 0.1px;
    }

    .jellycheckr-continue {
      width: 100%;
      min-height: 52px;
      border-radius: 8px;
      border: none;
      background: #e50914;
      color: #fff;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 18px rgba(229, 9, 20, 0.5);
      transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
      letter-spacing: 0.2px;
    }

    .jellycheckr-continue:hover,
    .jellycheckr-continue:focus-visible {
      background: #f6121d;
      transform: translateY(-2px);
      box-shadow: 0 6px 22px rgba(229, 9, 20, 0.65);
      outline: none;
    }

    .jellycheckr-continue:active {
      transform: translateY(0);
    }

    .jellycheckr-countdown {
      font-size: 0.82rem;
      color: rgba(255, 255, 255, 0.45);
      margin: 12px 0 14px 0;
    }

    .jellycheckr-countdown strong {
      color: rgba(255, 255, 255, 0.7);
      font-weight: 600;
    }

    .jellycheckr-stop {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.4);
      font-size: 0.82rem;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: color 0.15s ease;
    }

    .jellycheckr-stop:hover,
    .jellycheckr-stop:focus-visible {
      color: rgba(255, 255, 255, 0.75);
      outline: none;
    }

    .jellycheckr-continue:focus-visible,
    .jellycheckr-stop:focus-visible {
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.4);
    }

    @keyframes jellyFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    @keyframes jellyModalIn {
      to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    }
  `;

  document.head.appendChild(style);
}