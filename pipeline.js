[
  {
    $lookup: {
      from: "ratings",
      let: {
        userId: "$_id"
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $eq: ["$userId", "$$userId"]
            }
          }
        }
      ],
      as: "userRatings"
    }
  },
  {
    $lookup: {
      from: "comments",
      let: {
        userId: "$_id"
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $eq: ["$userId", "$$userId"] // Note: "Seq" appears to be a typo for $eq
            }
          }
        }
      ],
      as: "userComments"
    }
  },
  {
    $project: {
      _id: 0,
      name: 1,
      totalRatings: {
        $size: "$userRatings"
      },
      totalComments: {
        $size: "$userComments"
      },
      avgRatingScore: {
        $cond: [
          {
            $gt: [
              {
                $size: "$userRatings"
              },
              0
            ]
          },
          {
            $avg: "$userRatings.score"
          },
          null
        ]
      }
    }
  }
]