import { useContext } from "react";
import { IoOpenOutline } from "react-icons/io5";
import { deleteBucket, toggleBucketLock } from "../../../db";
import { openTabGroup, openTabInWindow } from "../../../services";
import { BucketContext } from "../context/context";
import { CiLock, CiUnlock } from "react-icons/ci";
import { MdOutlineDelete } from "react-icons/md";

function OptionsMenu({ ref, bucket, currentBucketMenu, isLastSession }) {
  const bucketContext = useContext(BucketContext);
  const getWorkspaces = bucketContext?.getWorkspaces;

  async function bucketLockHandler(id) {
    await toggleBucketLock(id);
    getWorkspaces();
  }

  function onOpenAsGroupTabsHandler(bucket) {
    openTabGroup(bucket);
  }

  function openTabsInNewWindow(bucket) {
    openTabInWindow(bucket);
  }

  async function deleteBucketHandler(id) {
    await deleteBucket(id);
    getWorkspaces();
  }

  return (
    <>
      {currentBucketMenu === bucket.id && (
        <div
          ref={ref}
          className="absolute z-20 top-full right-0 w-fit p-4 m-2 flex flex-col gap-2 bg-[#262831] rounded-lg shadow-lg"
        >
          <button
            className="bg-[#2a2e3b] hover:bg-[#364155] text-blue-200 rounded-full py-1 px-4 cursor-pointer flex gap-1 items-center hover:shadow-lg transition-shadow duration-200 ease-in-out"
            onClick={() => onOpenAsGroupTabsHandler(bucket)}
          >
            <IoOpenOutline />
            <p>Open as group</p>
          </button>
          <button
            className="bg-[#2a2e3b] hover:bg-[#364155] text-blue-200 rounded-full py-1 px-4 cursor-pointer flex gap-1 items-center hover:shadow-lg transition-shadow duration-200 ease-in-out"
            onClick={() => openTabsInNewWindow(bucket)}
          >
            <IoOpenOutline />
            <p>Open in new window</p>
          </button>
          {!isLastSession && (
            <button
              className="py-1 px-4 cursor-pointer bg-[#2a2e3b] hover:bg-[#364155] text-blue-200 rounded-full flex gap-1 items-center hover:shadow-lg transition-shadow duration-200 ease-in-out"
              onClick={(e) => bucketLockHandler(bucket.id)}
            >
              {bucket.isLocked ? <CiUnlock /> : <CiLock />}
              {bucket.isLocked ? "Unlock" : "Lock"}
            </button>
          )}
          <button
            className="bg-[#2a2e3b] hover:bg-[#364155] text-blue-200 rounded-full py-1 px-4 cursor-pointer flex gap-1 items-center hover:shadow-lg transition-shadow duration-200 ease-in-out"
            onClick={() => deleteBucketHandler(bucket.id)}
          >
            <MdOutlineDelete />
            <p>Delete</p>
          </button>
        </div>
      )}
    </>
  );
}

export default OptionsMenu;
