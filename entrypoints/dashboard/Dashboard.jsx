import { useContext, useState } from "react";
import { BucketContext } from "./context/context.jsx";
import Navbar from "./components/Navbar.jsx";
import SideBar from "./components/SideBar.jsx";
import LoadingSpinner from "./components/LoadingSpinner.jsx";
import WorkspaceMenu from "./components/WorkspaceMenu.jsx";
import BucketsContainer from "./components/BucketsContainer.jsx";
import { defaultWorkspaces } from "../../utils/constants/index.js";

function Dashboard() {
  const { loading, workspaces, lastSession, getWorkspaces } =
    useContext(BucketContext);

  const [tag, setTag] = useState("All");
  const [isAddWorkspaceMenuOpen, setIsAddWorkspaceMenuOpen] = useState(false);

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
    <div className="bg-[#222222] relative">
      {/* <WorkspaceMenu isAddWorkspaceMenuOpen={isAddWorkspaceMenuOpen} setIsAddWorkspaceMenuOpen={setIsAddWorkspaceMenuOpen} /> */}
      <div className="min-h-svh max-w-5xl m-auto w-full gap-4 text-base bg-[#222222] text-white">
        <LoadingSpinner loading={loading} />
        <Navbar />
        <main className="relative flex gap-4 px-6">
          <SideBar
            tag={tag}
            setTag={setTag}
            setIsAddWorkspaceMenuOpen={setIsAddWorkspaceMenuOpen}
          />
          <div className="w-full h-full pb-6">
            {tag === defaultWorkspaces.LAST_SESSION ? (
              <>
                <p className="font-bold text-lg pb-2 ">Last Session</p>
                <div className="w-full h-auto flex flex-col gap-1">
                  {lastSession?.map(
                    ({ id, title, favIconUrl, url }, index, array) => {
                      return (
                        <a
                          className="w-fit hover:underline hover:text-blue-200 cursor-pointer flex items-center gap-2 text-white"
                          target="_blank"
                          key={id}
                          href={url}
                        >
                          <img
                            src={favIconUrl}
                            width={20}
                            height={20}
                            className=""
                            alt={`icon of ${title}`}
                          />
                          <p>{title}</p>
                        </a>
                      );
                    }
                  )}
                </div>
              </>
            ) : (
              <BucketsContainer
                buckets={newListOfBuckets}
                loading={loading}
                tag={tag}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
export default Dashboard;
