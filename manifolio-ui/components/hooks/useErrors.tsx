import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

export type ManifolioError = {
  key: string;
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

  const pushError = useCallback((error: ManifolioError) => {
    // Don't allow duplicate errors
    setErrors((errors) => {
      const newErrors = errors.filter((e) => e.key !== error.key);
      return [...newErrors, error];
    });
  }, []);

  const clearError = useCallback((key: string) => {
    setErrors((errors) => errors.filter((error) => error.key !== key));
  }, []);

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
