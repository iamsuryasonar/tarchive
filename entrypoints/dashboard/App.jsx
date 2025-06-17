import { BucketProvider } from './context/context.jsx';
import Dashboard from './Dashboard.jsx';

function App() {
  return (
    <>
      <BucketProvider>
        <Dashboard />
      </BucketProvider>
    </>
  );
}
export default App;