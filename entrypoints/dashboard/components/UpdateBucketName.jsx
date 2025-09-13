import { useState, useContext, useRef } from "react";
import { toast } from "react-toastify";
import { renameBucketName } from "../../../db";
import { BucketContext } from "../context/context";
import useOutsideClick from "../../../hooks/useOutsideClick";

function UpdateBucketName({ bucket, setIdOfSelectedBucket }) {
  const [bucketInput, setBucketInput] = useState(bucket?.name || "");
  const inputContainerRef = useRef(null);
  const inputRef = useRef(null);

  const bucketContext = useContext(BucketContext);
  const getWorkspaces = bucketContext?.getWorkspaces;

  useOutsideClick(inputContainerRef, (e) => {
    setBucketInput("");
    setIdOfSelectedBucket("");
  });

  async function onBucketNameSubmit(id) {
    if (bucketInput.length < 6) {
      toast("bucket name must be 6 character long!");
      return;
    }
    await renameBucketName(id, bucketInput);
    setIdOfSelectedBucket("");
    getWorkspaces();
  }

  async function onEnterPressed(e, id) {
    if (e.key === "Enter") {
      onBucketNameSubmit(id);
    }
  }

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [bucket]);

  return (
    <div
      ref={inputContainerRef}
      className="h-full w-full flex items-stretch gap-2"
    >
      <input
        id="bucket_name"
        ref={inputRef}
        className="w-full h-full px-4 border-1 border-white/[0.2] hover:border-white rounded-full "
        type="text"
        name="bucketName"
        value={bucketInput}
        onChange={(e) => setBucketInput(e.target.value)}
        onKeyDown={(e) => onEnterPressed(e, bucket.id)}
      />
      <button
        className="h-full px-3 border-[1px] border-white/[0.2] hover:border-white rounded-full font-semibold cursor-pointer"
        onClick={(e) => onBucketNameSubmit(bucket.id)}
      >
        save
      </button>
    </div>
  );
}

export default UpdateBucketName;
