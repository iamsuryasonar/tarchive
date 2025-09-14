import { useContext, useState } from "react";
import { BucketContext } from "./context/context.jsx";
import Navbar from "./components/Navbar.jsx";
import SideBar from "./components/SideBar.jsx";
import LoadingSpinner from "./components/LoadingSpinner.jsx";
import BucketsContainer from "./components/BucketsContainer.jsx";

function Dashboard() {
  const context = useContext(BucketContext);
  if (!context) return null;

  const { loading, workspaces, getWorkspaces } = context;

  const [tag, setTag] = useState("All");

  let newListOfBuckets = workspaces[tag];

  useEffect(() => {
    const channel = new BroadcastChannel("tarchive_channel");

    channel.onmessage = (event) => {
      if (event.data.type === "workspaces_updated") {
        getWorkspaces();
      }
    };

    return () => channel.close();
  }, []);

  return (
    <div className="bg-[#222222] relative min-h-svh h-full">
      <div className="min-h-svh max-w-5xl m-auto w-full gap-4 text-base bg-[#222222] text-white">
        <LoadingSpinner loading={loading} />
        <Navbar />
        <main className="relative flex gap-4 px-6">
          <SideBar tag={tag} setTag={setTag} />
          <div className="w-full h-full py-6 relative">
            <BucketsContainer
              buckets={newListOfBuckets}
              loading={loading}
              tag={tag}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
export default Dashboard;
