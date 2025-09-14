import { useContext, useRef } from "react";
import { IoOpenOutline } from "react-icons/io5";
import { CgMenuRightAlt } from "react-icons/cg";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
import { deleteTab, toggleTag } from "../../../db";
import { openTabs } from "../../../services";
import { BucketContext } from "../context/context";
import useOutsideClick from "../../../hooks/useOutsideClick";
import OptionsMenu from "./OptionsMenu";
import UpdateBucketName from "./UpdateBucketName";
import icon from "/icon/128.png";

function BucketCard(props) {
  const {
    bucket,
    idOfSelectedBucket,
    setIdOfSelectedBucket,
    currentBucketMenu,
    setCurrentBucketMenu,
    isLastSession,
  } = props;

  const bucketContext = useContext(BucketContext);
  const getWorkspaces = bucketContext?.getWorkspaces;

  const bucketMenuRef = useRef(null);

  useOutsideClick(bucketMenuRef, (e) => {
    setCurrentBucketMenu("");
  });

  async function toggleTagHandler(id, tag) {
    await toggleTag(id, tag);
    await getWorkspaces();
  }

  function onOpenTabsHandler(tabs) {
    openTabs(tabs);
  }

  function toggleBucketMenu(id) {
    if (currentBucketMenu === id) {
      setCurrentBucketMenu("");
    } else {
      setCurrentBucketMenu(id);
    }
  }

  async function deleteTabHandler(tabId, bucketId, url) {
    await deleteTab(tabId, bucketId, url);
    await getWorkspaces();
  }

  return (
    <div key={bucket.id} className="h-full flex flex-col gap-2 text-white">
      <div className="h-[44px] p-1 relative pl-1 flex items-center justify-between gap-6 bg-[#262831] rounded-full">
        {!isLastSession ? (
          <div className="w-full h-full">
            {idOfSelectedBucket !== bucket.id ? (
              <button
                onClick={() => setIdOfSelectedBucket(bucket.id)}
                className="pl-3 font-bold text-lg min-w-[150px] w-full h-full text-start align-middle cursor-pointer"
              >
                {bucket.name}
              </button>
            ) : (
              <UpdateBucketName
                bucket={bucket}
                setIdOfSelectedBucket={setIdOfSelectedBucket}
              />
            )}
          </div>
        ) : (
          <div></div>
        )}
        <div className="flex gap-2">
          {!isLastSession && (
            <button
              className="bg-[#2a2e3b] hover:bg-[#364155] text-blue-200 rounded-full py-1 px-4 cursor-pointer flex gap-1 items-center"
              onClick={() => toggleTagHandler(bucket.id, "Favorite")}
            >
              {bucket?.tag?.includes("Favorite") ? <FaHeart /> : <FaRegHeart />}
            </button>
          )}
          <button
            className="bg-[#2a2e3b] hover:bg-[#364155] text-blue-200 rounded-full py-1 px-4 cursor-pointer flex gap-1 items-center"
            onClick={() => onOpenTabsHandler(bucket.tabs)}
          >
            <IoOpenOutline />
            <p>open</p>
          </button>
          {currentBucketMenu !== bucket.id ? (
            <button
              className="py-1 px-4 cursor-pointer flex gap-1 items-center text-blue-200 hover:text-white"
              onClick={() => toggleBucketMenu(bucket.id)}
            >
              <CgMenuRightAlt size={20} />
            </button>
          ) : (
            <button
              className="py-1 px-4 cursor-pointer flex gap-1 items-center text-blue-200 hover:text-white "
              onClick={() => setCurrentBucketMenu("")}
            >
              <IoMdClose size={20} />
            </button>
          )}
        </div>
        <OptionsMenu
          ref={bucketMenuRef}
          bucket={bucket}
          currentBucketMenu={currentBucketMenu}
          isLastSession={isLastSession}
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="px-4 flex flex-col gap-1">
          {bucket.tabs.map(({ id, url, title, favIconUrl }) => {
            return (
              <div key={`${id + url}`} className="flex justify-between">
                <a
                  className="w-fit hover:underline hover:text-blue-200 cursor-pointer flex items-center gap-2"
                  target="_blank"
                  key={id}
                  href={url}
                >
                  <img
                    src={favIconUrl || icon}
                    width={20}
                    height={20}
                    className=""
                    alt={`${title}`}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = icon;
                    }}
                  />
                  <p>{title}</p>
                </a>
                <button
                  onClick={() => deleteTabHandler(id, bucket.id, url)}
                  className="text-white/80 hover:text-white cursor-pointer"
                >
                  <IoMdClose />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default BucketCard;
