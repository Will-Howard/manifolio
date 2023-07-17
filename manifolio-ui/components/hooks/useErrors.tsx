import React, { ReactNode, createContext, useContext, useState } from "react";

export type ManifolioErrorCode = "NETWORK_ERROR" | "UNKNOWN_ERROR";

export type ManifolioError = {
  key: string;
  code: ManifolioErrorCode;
  message: string;
  severity: "error" | "warning";
};

type ErrorContextType = {
  errors: ManifolioError[];
  pushError: (error: ManifolioError) => void;
  clearError: (key: string) => void;
};

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

const useErrorsInternal = (): ErrorContextType => {
  const [errors, setErrors] = useState<ManifolioError[]>([]);

  function pushError(error: ManifolioError) {
    setErrors((errors) => [...errors, error]);
  }

  function clearError(key: string) {
    setErrors((errors) => errors.filter((error) => error.key !== key));
  }

  return { errors, pushError, clearError };
};

export const ErrorProvider: React.FC<{ children?: ReactNode }> = ({
  children,
}) => {
  const errorHandlers: ErrorContextType = useErrorsInternal();

  return (
    <ErrorContext.Provider value={errorHandlers}>
      {children}
    </ErrorContext.Provider>
  );
};

export function useErrors() {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error("useErrors must be used within a ErrorProvider");
  }
  return context;
}
