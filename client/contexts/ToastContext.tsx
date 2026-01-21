import React, { createContext, useContext, useState, ReactNode } from "react";
import { Toast, ToastType } from "@/components/Toast";

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showWarning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<ToastType>("info");

  const showToast = (msg: string, toastType: ToastType = "info") => {
    setMessage(msg);
    setType(toastType);
    setVisible(true);
  };

  const showError = (msg: string) => showToast(msg, "error");
  const showSuccess = (msg: string) => showToast(msg, "success");
  const showWarning = (msg: string) => showToast(msg, "warning");

  const handleHide = () => {
    setVisible(false);
  };

  return (
    <ToastContext.Provider value={{ showToast, showError, showSuccess, showWarning }}>
      {children}
      <Toast
        visible={visible}
        message={message}
        type={type}
        onHide={handleHide}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
