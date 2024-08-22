import dynamic from "next/dynamic";
import "../globals.css";

// Dynamically import the client-side component
const DynamicResetPasswordClient = dynamic(
  () => import("./ResetPasswordClient"),
  { ssr: false }
);

const ResetPasswordPage: React.FC = () => {
  return <DynamicResetPasswordClient />;
};

export default ResetPasswordPage;
