import { Slide, ToastContainer } from "react-toastify";
import { BucketProvider } from "./context/context.jsx";
import Dashboard from "./Dashboard.jsx";
function App() {
  return (
    <BucketProvider>
      <Dashboard />
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        transition={Slide}
      />
    </BucketProvider>
  );
}
export default App;
