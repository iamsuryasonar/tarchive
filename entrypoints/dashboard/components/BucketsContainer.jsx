import { useState } from "react";
import BucketCard from "./BucketCard";
import { defaultWorkspaces } from "../../../utils/constants";

function BucketsContainer({ buckets, loading, tag }) {
  const [currentBucketMenu, setCurrentBucketMenu] = useState("");
  const [idOfSelectedBucket, setIdOfSelectedBucket] = useState("");
  const isLastSession = tag === defaultWorkspaces.LAST_SESSION;

  return (
    <div className="w-full h-auto flex flex-col gap-4">
      {((!loading && !buckets) || buckets?.length === 0) && (
        <p className="px-4 place-self-center">
          You have no bucket in {tag} workspace!
        </p>
      )}
      {buckets?.map((bucket) => {
        return (
          <BucketCard
            key={bucket.id}
            bucket={bucket}
            idOfSelectedBucket={idOfSelectedBucket}
            setIdOfSelectedBucket={setIdOfSelectedBucket}
            currentBucketMenu={currentBucketMenu}
            setCurrentBucketMenu={setCurrentBucketMenu}
            isLastSession={isLastSession}
          />
        );
      })}
    </div>
  );
}

export default BucketsContainer;
