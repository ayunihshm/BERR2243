db.getCollection('users').aggregate(
  [
    {
      $lookup: {
        from: 'ratings',
        let: { userId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$userId', '$$userId']
              }
            }
          }
        ],
        as: 'userRatings'
      }
    },
    {
      $lookup: {
        from: 'comments',
        let: { userId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$userId', '$$userId']
              }
            }
          }
        ],
        as: 'userComments'
      }
    },
    {
      $project: {
        _id: 0,
        name: 1,
        totalRatings: { $size: '$userRatings' },
        totalComments: { $size: '$userComments' },
        avgRatingScore: {
          $cond: [
            {
              $gt: [{ $size: '$userRatings' }, 0]
            },
            { $avg: '$userRatings.score' },
            null
          ]
        }
      }
    }
  ],
  { maxTimeMS: 60000, allowDiskUse: true }
);